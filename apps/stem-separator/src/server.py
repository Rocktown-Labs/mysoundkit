"""SoundKit stem-separator container: Demucs htdemucs on PyTorch CPU.

Only talks to http://soundkit-r2.internal (zero-internet container).
Stdlib only: no web framework dependency to keep the image small.
"""

import json
import os
import shutil
import subprocess
import tempfile
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError

from separator import (
    INSTRUMENTAL_STEM_NAME,
    VOCALS_STEM_NAME,
    build_demucs_command,
    build_ffmpeg_mp3_command,
    build_ffmpeg_preview_command,
    check_separate_payload,
    object_url,
)

PORT = int(os.environ.get("PORT", "8080"))
MAX_JSON_BODY_BYTES = 256 * 1024
R2_TIMEOUT_SECONDS = 600
DEMUCS_TIMEOUT_SECONDS = 20 * 60
FFMPEG_TIMEOUT_SECONDS = 10 * 60

_job_lock = threading.Lock()


def _json(handler, status, body):
    payload = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _download(url, dest_path):
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=R2_TIMEOUT_SECONDS) as res, open(
            dest_path, "wb"
        ) as out:
            shutil.copyfileobj(res, out, length=1024 * 256)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise RuntimeError(f"Master download failed: {error}") from error


def _upload(local_path, object_key, content_type="audio/mpeg"):
    size = os.path.getsize(local_path)
    url = object_url(object_key)
    req = urllib.request.Request(url, method="PUT")
    req.add_header("content-type", content_type)
    req.add_header("content-length", str(size))
    try:
        with open(local_path, "rb") as body:
            with urllib.request.urlopen(req, data=body, timeout=R2_TIMEOUT_SECONDS):
                pass
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise RuntimeError(f"Stem upload failed for {object_key}: {error}") from error
    return size


def _run(cmd, timeout):
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            f"Command timed out after {timeout}s ({' '.join(cmd[:4])}): {error}"
        ) from error
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "")[-2000:]
        raise RuntimeError(f"Command failed ({' '.join(cmd[:4])}): {detail}")
    return proc


def separate(source_key, vocals_key, instrumental_key, preview_key=None):
    """Download master, run Demucs, transcode + upload vocals/instrumental.

    When preview_key is given, also uploads a 16 kHz mono transcription
    proxy of the vocals so lyrics fit one Workers AI call.
    """
    workdir = tempfile.mkdtemp(prefix="stemsep-")
    try:
        input_path = os.path.join(workdir, "input")
        _download(object_url(source_key), input_path)
        demucs_out = os.path.join(workdir, "demucs")
        os.makedirs(demucs_out, exist_ok=True)
        _run(build_demucs_command(input_path, demucs_out), DEMUCS_TIMEOUT_SECONDS)
        # Demucs layout: <out>/htdemucs/<basename>/{vocals,no_vocals}.wav
        roots = []
        for dirpath, _dirnames, filenames in os.walk(demucs_out):
            if "vocals.wav" in filenames and "no_vocals.wav" in filenames:
                roots.append(dirpath)
                break
        if not roots:
            raise RuntimeError("Demucs produced no stems.")
        stem_dir = roots[0]
        vocals_mp3 = os.path.join(workdir, "vocals.mp3")
        instrumental_mp3 = os.path.join(workdir, "no_vocals.mp3")
        _run(
            build_ffmpeg_mp3_command(
                os.path.join(stem_dir, f"{VOCALS_STEM_NAME}.wav"), vocals_mp3
            ),
            FFMPEG_TIMEOUT_SECONDS,
        )
        _run(
            build_ffmpeg_mp3_command(
                os.path.join(stem_dir, f"{INSTRUMENTAL_STEM_NAME}.wav"),
                instrumental_mp3,
            ),
            FFMPEG_TIMEOUT_SECONDS,
        )
        vocals_bytes = _upload(vocals_mp3, vocals_key)
        instrumental_bytes = _upload(instrumental_mp3, instrumental_key)
        result = {
            "vocals": {"objectKey": vocals_key, "sizeBytes": vocals_bytes},
            "instrumental": {
                "objectKey": instrumental_key,
                "sizeBytes": instrumental_bytes,
            },
        }
        if preview_key:
            preview_mp3 = os.path.join(workdir, "vocals-preview.mp3")
            _run(
                build_ffmpeg_preview_command(
                    os.path.join(stem_dir, f"{VOCALS_STEM_NAME}.wav"),
                    preview_mp3,
                ),
                FFMPEG_TIMEOUT_SECONDS,
            )
            preview_bytes = _upload(preview_mp3, preview_key)
            result["preview"] = {
                "objectKey": preview_key,
                "sizeBytes": preview_bytes,
            }
        return result
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "SoundKitStemSeparator/1.0"

    def log_message(self, *args):
        pass

    def _read_json(self):
        try:
            length = int(self.headers.get("content-length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_JSON_BODY_BYTES:
            raise ValueError("Request payload is too large or empty.")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            _json(self, 200, {"ok": True, "service": "soundkit-stem-separator"})
            return
        _json(self, 404, {"message": "Not found."})

    def do_POST(self):
        if self.path != "/v1/separate":
            _json(self, 404, {"message": "Not found."})
            return
        if not _job_lock.acquire(blocking=False):
            _json(self, 409, {"message": "Separator is busy."})
            return
        try:
            try:
                body = self._read_json()
                source, vocals, instrumental, preview = check_separate_payload(
                    body
                )
            except ValueError as error:
                _json(self, 400, {"message": str(error)})
                return
            try:
                result = separate(source, vocals, instrumental, preview)
            except RuntimeError as error:
                _json(self, 500, {"message": str(error)[:2000]})
                return
            except BrokenPipeError:
                # Client went away mid-response; job result is lost but the
                # Workflow step will time out and surface a retryable error.
                return
            _json(self, 200, result)
        finally:
            _job_lock.release()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    # Mirror media-processor: allow long Demucs CPU jobs.
    server.timeout = 35 * 60
    print(f"SoundKit stem separator listening on {PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
