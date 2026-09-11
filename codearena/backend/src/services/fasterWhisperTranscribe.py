#!/usr/bin/env python3
"""Small CLI bridge between the Node backend and faster-whisper."""

import argparse
from pathlib import Path

from faster_whisper import WhisperModel


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--cpu-threads", type=int)
    parser.add_argument("--initial-prompt", default="")
    return parser.parse_args()


def main():
    args = parse_args()
    model_options = {
        "device": args.device,
        "compute_type": args.compute_type,
    }
    if args.cpu_threads:
        model_options["cpu_threads"] = args.cpu_threads

    model = WhisperModel(args.model, **model_options)
    segments, _ = model.transcribe(
        args.input,
        language=args.language or None,
        beam_size=1,
        condition_on_previous_text=False,
        initial_prompt=args.initial_prompt or None,
    )
    transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
    Path(args.output).write_text(transcript, encoding="utf-8")


if __name__ == "__main__":
    main()
