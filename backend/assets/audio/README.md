# Audio Assets

This directory contains audio files used by the TTS service.

## Files

- `pause_500ms.wav` - 500ms silence for conversation pauses
- `pause_1000ms.wav` - 1000ms silence for longer pauses

## Generating Pause Files

To generate pause files, you can use ffmpeg:

```bash
# Generate 500ms silence
ffmpeg -f lavfi -i anullsrc=r=8000:cl=mono -t 0.5 -acodec pcm_s16le pause_500ms.wav

# Generate 1000ms silence  
ffmpeg -f lavfi -i anullsrc=r=8000:cl=mono -t 1.0 -acodec pcm_s16le pause_1000ms.wav
```

These files are used by the conversation assembly feature to add natural pauses between speech segments.