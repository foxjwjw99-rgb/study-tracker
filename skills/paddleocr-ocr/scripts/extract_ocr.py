#!/usr/bin/env python3
import argparse
import contextlib
import io
import json
import os
import re
import sys
import warnings
from pathlib import Path

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
warnings.filterwarnings("ignore")

TIMESTAMP_RE = re.compile(r"^\d{1,2}:\d{2}$")
STRONG_END_RE = re.compile(r"[。！？!?…]$")
ASCII_WORD_RE = re.compile(r"^[A-Za-z0-9].*[A-Za-z0-9]$")
COMMON_UI_NOISE = {
    "menu",
    "message",
    "messages",
    "send",
    "search",
    "back",
    "info",
    "today",
    "yesterday",
    "online",
}
SINGLE_CHAR_NOISE = {"三", "⋮", "·", "•", "0"}


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
    parser.add_argument(
        "--chat-clean",
        action="store_true",
        help="Remove common chat UI noise and merge wrapped message lines",
    )
    parser.add_argument("--output", help="Write output to a file instead of stdout")
    return parser


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


def normalize_prediction_item(item, min_score: float, keep_low: bool) -> dict:
    if hasattr(item, "json"):
        item = item.json
    if isinstance(item, dict) and "res" in item and isinstance(item["res"], dict):
        item = item["res"]

    if not isinstance(item, dict):
        return {"input_path": None, "page_index": None, "lines": [], "text": "", "clean_text": ""}

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
        "clean_text": "",
    }


def run_prediction(ocr, path: str, min_score: float, keep_low: bool) -> list:
    prediction = run_quietly(lambda: ocr.predict(path))
    return [normalize_prediction_item(item, min_score, keep_low) for item in prediction or []]


def is_timestamp(text: str) -> bool:
    return bool(TIMESTAMP_RE.fullmatch(text.strip()))


def is_ui_noise(text: str) -> bool:
    stripped = text.strip()
    lowered = stripped.lower()
    if lowered in COMMON_UI_NOISE:
        return True
    if stripped in SINGLE_CHAR_NOISE:
        return True
    if re.fullmatch(r"\d+", stripped):
        return True
    return False


def join_fragments(left: str, right: str) -> str:
    if not left:
        return right
    if not right:
        return left

    if ASCII_WORD_RE.match(left) and ASCII_WORD_RE.match(right):
        return f"{left} {right}"

    if left.endswith(("-", "—")):
        return left + right

    return left + right


def clean_chat_text(lines: list) -> str:
    paragraphs = []
    current = ""
    pending_boundary = False

    for line in lines:
        text = line.get("text", "").strip()
        if not text:
            continue

        if is_ui_noise(text):
            continue

        if is_timestamp(text):
            if current and (len(current) >= 8 or STRONG_END_RE.search(current)):
                pending_boundary = True
            continue

        if pending_boundary and current:
            paragraphs.append(current)
            current = ""
            pending_boundary = False

        current = join_fragments(current, text)

    if current:
        paragraphs.append(current)

    return "\n\n".join(part.strip() for part in paragraphs if part.strip())


def apply_chat_clean(results: list) -> list:
    cleaned = []
    for result in results:
        updated = dict(result)
        updated["clean_text"] = clean_chat_text(result.get("lines", []))
        cleaned.append(updated)
    return cleaned


def render_text(results: list, use_clean_text: bool = False) -> str:
    chunks = []
    multi = len(results) > 1
    for result in results:
        header = result.get("input_path") or "<unknown>"
        field = "clean_text" if use_clean_text else "text"
        text = result.get(field, "").strip()
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

    if args.chat_clean:
        all_results = apply_chat_clean(all_results)

    if args.format == "json":
        rendered = json.dumps(all_results, ensure_ascii=False, indent=2)
    elif args.format == "lines":
        rendered = render_lines(all_results)
    else:
        rendered = render_text(all_results, use_clean_text=args.chat_clean)

    if args.output:
        Path(args.output).write_text(rendered + ("\n" if not rendered.endswith("\n") else ""), encoding="utf-8")
    else:
        print(rendered)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
