import unittest

from separator import (
    build_demucs_command,
    build_ffmpeg_mp3_command,
    build_ffmpeg_preview_command,
    check_separate_payload,
    is_valid_object_key,
)


class SeparatorTest(unittest.TestCase):
    def test_valid_keys(self):
        self.assertTrue(is_valid_object_key("tracks/abc/master.mp3"))
        self.assertTrue(is_valid_object_key("processed/tracks/x/v2/vocals.mp3"))
        self.assertFalse(is_valid_object_key(""))
        self.assertFalse(is_valid_object_key("/absolute.mp3"))
        self.assertFalse(is_valid_object_key("../escape.mp3"))
        self.assertFalse(is_valid_object_key("a/../b.mp3"))
        self.assertFalse(is_valid_object_key("x" * 1025))

    def test_demucs_args(self):
        cmd = build_demucs_command("/tmp/in.mp3", "/tmp/out")
        self.assertEqual(
            cmd,
            [
                "python",
                "-m",
                "demucs",
                "--two-stems",
                "vocals",
                "-n",
                "htdemucs",
                "--float32",
                "-d",
                "cpu",
                "--out",
                "/tmp/out",
                "/tmp/in.mp3",
            ],
        )

    def test_ffmpeg_args(self):
        cmd = build_ffmpeg_mp3_command("/tmp/v.wav", "/tmp/v.mp3")
        self.assertIn("libmp3lame", cmd)
        self.assertIn("320k", cmd)

    def test_preview_args(self):
        cmd = build_ffmpeg_preview_command("/tmp/v.wav", "/tmp/v-preview.mp3")
        self.assertIn("16000", cmd)
        self.assertIn("64k", cmd)
        self.assertIn("1", cmd)

    def test_payload(self):
        source, vocals, inst, preview = check_separate_payload(
            {
                "sourceObjectKey": "tracks/a/master.mp3",
                "targetVocalsKey": "processed/tracks/a/v2/vocals.mp3",
                "targetInstrumentalKey": "processed/tracks/a/v2/instrumental.mp3",
                "targetPreviewKey": "processed/tracks/a/v2/vocals-preview.mp3",
            }
        )
        self.assertEqual(source, "tracks/a/master.mp3")
        self.assertEqual(vocals, "processed/tracks/a/v2/vocals.mp3")
        self.assertEqual(inst, "processed/tracks/a/v2/instrumental.mp3")
        self.assertEqual(preview, "processed/tracks/a/v2/vocals-preview.mp3")

    def test_payload_without_preview(self):
        source, vocals, inst, preview = check_separate_payload(
            {
                "sourceObjectKey": "tracks/a/master.mp3",
                "targetVocalsKey": "processed/tracks/a/v2/vocals.mp3",
                "targetInstrumentalKey": "processed/tracks/a/v2/instrumental.mp3",
            }
        )
        self.assertEqual(source, "tracks/a/master.mp3")
        self.assertIsNone(preview)
        with self.assertRaises(ValueError):
            check_separate_payload({"sourceObjectKey": "../x"})
        with self.assertRaises(ValueError):
            check_separate_payload("nope")
        with self.assertRaises(ValueError):
            check_separate_payload(
                {
                    "sourceObjectKey": "tracks/a/master.mp3",
                    "targetVocalsKey": "processed/tracks/a/v2/vocals.mp3",
                    "targetInstrumentalKey": "processed/tracks/a/v2/instrumental.mp3",
                    "targetPreviewKey": "../evil.mp3",
                }
            )


if __name__ == "__main__":
    unittest.main()
