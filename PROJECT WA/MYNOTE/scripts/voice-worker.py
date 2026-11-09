#!/usr/bin/env python3
"""MYNOTE voice worker.

Loads a faster-whisper model once, then transcribes audio files requested as
JSON lines on stdin. Responses are written as JSON lines on stdout.

Request:  {"id": "<id>", "path": "<absolute audio path>"}
Response: {"id": "<id>", "text": "...", "language": "id", "durationMs": 1234}
Error:    {"id": "<id>", "error": "..."}
Startup:  {"ready": true, "model": "..."} or {"ready": false, "error": "..."}
"""

import argparse
import json
import sys


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="MYNOTE faster-whisper worker")
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--language", default="id")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--initial-prompt", default="")
    parser.add_argument("--hotwords", default="")
    parser.add_argument("--download-root", default=None)
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as error:  # noqa: BLE001
        emit({"ready": False, "error": f"faster-whisper belum terpasang: {error}"})
        return 1

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            download_root=args.download_root,
        )
    except Exception as error:  # noqa: BLE001
        emit({"ready": False, "error": f"Gagal memuat model {args.model}: {error}"})
        return 1

    emit({
        "ready": True,
        "model": args.model,
        "device": args.device,
        "computeType": args.compute_type,
    })

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except Exception:  # noqa: BLE001
            emit({"id": None, "error": "JSON tidak valid"})
            continue

        request_id = request.get("id")
        audio_path = request.get("path")
        if not audio_path:
            emit({"id": request_id, "error": "path kosong"})
            continue

        try:
            segments, info = model.transcribe(
                audio_path,
                language=args.language or None,
                beam_size=args.beam_size,
                vad_filter=True,
                condition_on_previous_text=False,
                initial_prompt=args.initial_prompt or None,
                hotwords=args.hotwords or None,
            )
            text = "".join(segment.text for segment in segments).strip()
            emit({
                "id": request_id,
                "text": text,
                "language": getattr(info, "language", None),
                "durationMs": int(round(float(getattr(info, "duration", 0.0)) * 1000)),
            })
        except Exception as error:  # noqa: BLE001
            emit({"id": request_id, "error": str(error)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
