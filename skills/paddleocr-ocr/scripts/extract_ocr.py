#!/usr/bin/env python3
import argparse
import contextlib
import io
import json
import os
import sys
import warnings
from pathlib import Path

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
warnings.filterwarnings("ignore")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract text from images or PDFs with PaddleOCR."
    )
    parser.add_argument("inputs", nargs="+", help="Input image/PDF paths")
    parser.add_argument("--lang", default="ch", help="PaddleOCR language, e.g. ch, en, japan")
    parser.add_argument(
        "--format",
        choices=["text", "json", "lines"],
        default="text",
        help="Output format",
    )
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.5,
        help="Drop lines below this confidence score unless --keep-low is set",
    )
    parser.add_argument(
        "--keep-low",
        action="store_true",
        help="Keep low-confidence lines instead of filtering them",
    )
    parser.add_argument("--output", help="Write output to a file instead of stdout")
    return parser


def load_ocr(lang: str):
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        print(
            "PaddleOCR is not installed. Run: python3 -m pip install paddlepaddle paddleocr",
            file=sys.stderr,
        )
        raise

    return run_quietly(lambda: PaddleOCR(use_textline_orientation=True, lang=lang))


def run_quietly(fn):
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
            return fn()
    except Exception:
        captured = stderr_buffer.getvalue().strip()
        if captured:
            print(captured, file=sys.stderr)
        raise


def normalize_prediction_item(item, min_score: float, keep_low: bool) -> dict:
    if hasattr(item, "json"):
        item = item.json
    if isinstance(item, dict) and "res" in item and isinstance(item["res"], dict):
        item = item["res"]

    if not isinstance(item, dict):
        return {"input_path": None, "page_index": None, "lines": [], "text": ""}

    texts = item.get("rec_texts") or []
    scores = item.get("rec_scores") or []
    lines = []

    for idx, raw_text in enumerate(texts):
        text = str(raw_text).strip()
        if not text:
            continue

        score = None
        if idx < len(scores):
            try:
                score = float(scores[idx])
            except Exception:
                score = None

        if not keep_low and score is not None and score < min_score:
            continue

        lines.append({"text": text, "score": score})

    return {
        "input_path": item.get("input_path"),
        "page_index": item.get("page_index"),
        "lines": lines,
        "text": "\n".join(line["text"] for line in lines),
    }


def run_prediction(ocr, path: str, min_score: float, keep_low: bool) -> list:
    prediction = run_quietly(lambda: ocr.predict(path))
    return [normalize_prediction_item(item, min_score, keep_low) for item in prediction or []]


def render_text(results: list) -> str:
    chunks = []
    multi = len(results) > 1
    for result in results:
        header = result.get("input_path") or "<unknown>"
        text = result.get("text", "").strip()
        if multi:
            chunks.append(f"# {header}\n{text}".rstrip())
        else:
            chunks.append(text)
    return "\n\n".join(chunk for chunk in chunks if chunk).strip()


def render_lines(results: list) -> str:
    rows = []
    multi = len(results) > 1
    for result in results:
        header = result.get("input_path") or "<unknown>"
        if multi:
            rows.append(f"# {header}")
        for line in result.get("lines", []):
            score = line.get("score")
            score_str = "" if score is None else f"{score:.3f}"
            rows.append(f"{score_str}\t{line['text']}")
    return "\n".join(rows).strip()


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    missing = [path for path in args.inputs if not Path(path).exists()]
    if missing:
        print("Missing input file(s):", file=sys.stderr)
        for path in missing:
            print(f"- {path}", file=sys.stderr)
        return 2

    ocr = load_ocr(args.lang)
    all_results = []
    for path in args.inputs:
        all_results.extend(run_prediction(ocr, path, args.min_score, args.keep_low))

    if args.format == "json":
        rendered = json.dumps(all_results, ensure_ascii=False, indent=2)
    elif args.format == "lines":
        rendered = render_lines(all_results)
    else:
        rendered = render_text(all_results)

    if args.output:
        Path(args.output).write_text(rendered + ("\n" if not rendered.endswith("\n") else ""), encoding="utf-8")
    else:
        print(rendered)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
