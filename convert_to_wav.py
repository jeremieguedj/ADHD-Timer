"""Convert raw PCM (L16, 24kHz, mono) files to proper WAV files."""
import struct
import os
import glob

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
SAMPLE_RATE = 24000
CHANNELS = 1
BITS_PER_SAMPLE = 16

for ogg_path in glob.glob(os.path.join(AUDIO_DIR, "*.ogg")):
    with open(ogg_path, "rb") as f:
        pcm_data = f.read()

    wav_path = ogg_path.replace(".ogg", ".wav")
    data_size = len(pcm_data)
    byte_rate = SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE // 8
    block_align = CHANNELS * BITS_PER_SAMPLE // 8

    with open(wav_path, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", 36 + data_size))
        f.write(b"WAVE")
        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))  # chunk size
        f.write(struct.pack("<H", 1))   # PCM format
        f.write(struct.pack("<H", CHANNELS))
        f.write(struct.pack("<I", SAMPLE_RATE))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", BITS_PER_SAMPLE))
        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(pcm_data)

    os.remove(ogg_path)
    print(f"Converted {os.path.basename(ogg_path)} -> {os.path.basename(wav_path)} ({data_size} bytes PCM)")

print("Done!")
