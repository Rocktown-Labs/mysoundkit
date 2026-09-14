"""Demucs stem-separation helpers (pure functions, unit tested)."""

SEPARATION_MODEL = "htdemucs"
INTERNAL_R2_ORIGIN = "http://soundkit-r2.internal"
VOCALS_STEM_NAME = "vocals"
INSTRUMENTAL_STEM_NAME = "no_vocals"
MP3_BITRATE = "320k"


def is_valid_object_key(value):
    """Mirror the Container capability check: no leading slash, no traversal."""
    if not isinstance(value, str):
        return False
    if len(value) == 0 or len(value) > 1024:
        return False
    if value.startswith("/"):
        return False
    if "../" in value or value in ("..",):
        return False
    return True


def build_demucs_command(input_path, output_dir, model=SEPARATION_MODEL):
    """Two-stem karaoke mode. Demucs still separates fully then mixes down."""
    return [
        "python",
        "-m",
        "demucs",
        "--two-stems",
        "vocals",
        "-n",
        model,
        "--float32",
        "-d",
        "cpu",
        "--out",
        output_dir,
        input_path,
    ]


def build_ffmpeg_mp3_command(wav_path, mp3_path):
    return [
        "ffmpeg",
        "-y",
        "-i",
        wav_path,
        "-codec:a",
        "libmp3lame",
        "-b:a",
        MP3_BITRATE,
        mp3_path,
    ]


def object_url(object_key):
    from urllib.parse import quote

    return f"{INTERNAL_R2_ORIGIN}/objects/{quote(object_key, safe='/')}"


def check_separate_payload(body):
    """Return (source, vocals, instrumental) or raise ValueError."""
    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object.")
    source = body.get("sourceObjectKey")
    vocals = body.get("targetVocalsKey")
    instrumental = body.get("targetInstrumentalKey")
    for label, value in (
        ("sourceObjectKey", source),
        ("targetVocalsKey", vocals),
        ("targetInstrumentalKey", instrumental),
    ):
        if not is_valid_object_key(value):
            raise ValueError(f"{label} is invalid.")
    return source, vocals, instrumental
