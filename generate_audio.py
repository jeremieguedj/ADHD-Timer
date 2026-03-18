"""Generate TTS audio files using Gemini API and save them to the extension."""
import json
import base64
import urllib.request
import os

API_KEY = "AIzaSyDz4hZBggBTAkso2mZ3A5qOI_s0zdxEcOw"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={API_KEY}"

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

MESSAGES = {
    "greeting": "Hi! I'm Hoppy the bunny! Enjoy your show!",
    "halfway": "You still have lots of time left! Having fun!",
    "quarter": "Getting closer! Not much time left!",
    "ten_minutes": "Ten minutes left! Almost done!",
    "five_minutes": "Only five minutes left! Time to start winding down...",
    "goodbye": "Thank you for watching! Hoppy says see you next time! Now let's go do something fun!",
}

for name, text in MESSAGES.items():
    print(f"Generating {name}: {text!r}")
    body = json.dumps({
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": "Puck"}
                }
            }
        }
    }).encode()

    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        audio_part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        audio_bytes = base64.b64decode(audio_part["data"])
        mime = audio_part.get("mimeType", "audio/wav")
        ext = "wav" if "wav" in mime else "mp3" if "mp3" in mime else "webm" if "webm" in mime else "ogg"
        filepath = os.path.join(AUDIO_DIR, f"{name}.{ext}")
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        print(f"  Saved {filepath} ({len(audio_bytes)} bytes, {mime})")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\nDone! Audio files saved to audio/")
