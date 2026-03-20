---
name: paddleocr-ocr
description: Extract text from screenshots, chat screenshots, photos, scans, and local image/PDF attachments with PaddleOCR. Use when a user asks to OCR an image, read text from a screenshot/photo/document, pull Chinese or English text from a local file, convert visual text into plain text or JSON, or clean OCR output from messaging-app screenshots by removing timestamps and UI chrome.
---

# PaddleOCR OCR

## Overview

Use `scripts/extract_ocr.py` for repeatable local OCR with PaddleOCR. Prefer plain text for user-facing extraction, use `--format json` or `--format lines` when confidence scores or downstream processing matter, and use `--chat-clean` for chat screenshots that include timestamps or app UI.

## Quick start

```bash
python3 scripts/extract_ocr.py /path/to/file.jpg
python3 scripts/extract_ocr.py /path/to/file.jpg --format json
python3 scripts/extract_ocr.py /path/to/file.jpg --format lines
python3 scripts/extract_ocr.py /path/to/file.jpg --output ./ocr.txt
```

## Install shell commands

Install convenient wrappers into `~/.local/bin`:

```bash
./scripts/install_commands.sh
```

This creates:
- `ocr`: generic OCR wrapper
- `ocr-chat`: OCR wrapper with `--chat-clean` enabled

Examples:

```bash
ocr ./scan.jpg
ocr ./scan.jpg --format json
ocr-chat ./chat-screenshot.jpg
ocr-chat ./chat-screenshot.jpg --output ./chat.txt
```

## Chat screenshot mode

Use this when OCRing Telegram, Signal, Discord, LINE, WhatsApp, or similar chat screenshots:

```bash
python3 scripts/extract_ocr.py /path/to/chat.jpg --chat-clean
python3 scripts/extract_ocr.py /path/to/chat.jpg --chat-clean --output ./chat.txt
```

`--chat-clean` will:
- remove common UI noise like `Menu`, `Message`, and standalone timestamps
- drop obvious single-character chrome/noise
- merge wrapped message lines into cleaner paragraphs

It is heuristic, not perfect. Review the result before presenting it as a final transcript.

## Workflow

1. Verify the input path exists.
2. If PaddleOCR is missing, install it with:
   ```bash
   python3 -m pip install paddlepaddle paddleocr
   ```
3. Run `scripts/extract_ocr.py`.
4. Use `--lang ch` for Chinese or mixed Chinese/English text. Try `--lang en` for English-only material.
5. Start with the default filtering.
6. Lower `--min-score` or add `--keep-low` if the image is blurry, noisy, stylized, or missing text you expect.
7. Use `--chat-clean` for chat screenshots before doing manual cleanup or summarization.

## Output modes

- `--format text`: Return joined text only. If `--chat-clean` is set, return cleaned text.
- `--format lines`: Return `score<TAB>text` per OCR line.
- `--format json`: Return structured OCR output including raw lines and `clean_text` when `--chat-clean` is set.

## Notes

- Expect the first run to take longer because PaddleOCR downloads models.
- Pass multiple input paths in one command to batch OCR several files.
- Use `--output` when the result should be saved for later use.
- Prefer `--format json` if another script will post-process OCR output.
