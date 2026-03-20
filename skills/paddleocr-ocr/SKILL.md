---
name: paddleocr-ocr
description: Extract text from screenshots, photos, scans, and local image/PDF attachments with PaddleOCR. Use when a user asks to OCR an image, read text from a screenshot/photo/document, pull Chinese or English text from a local file, or convert visual text into plain text or JSON with confidence filtering.
---

# PaddleOCR OCR

## Overview

Use `scripts/extract_ocr.py` to run repeatable local OCR with PaddleOCR. Prefer plain-text output for user-facing extraction, and use JSON or scored lines when another script or a cleanup step needs structure.

## Quick start

```bash
python3 scripts/extract_ocr.py /path/to/file.jpg
python3 scripts/extract_ocr.py /path/to/file.jpg --format lines
python3 scripts/extract_ocr.py /path/to/file.jpg --format json
python3 scripts/extract_ocr.py /path/to/file.jpg --output ./ocr.txt
```

## Workflow

1. Verify the input path exists.
2. If PaddleOCR is missing, install it with:
   ```bash
   python3 -m pip install paddlepaddle paddleocr
   ```
3. Run `scripts/extract_ocr.py`.
4. Use `--lang ch` for Chinese or mixed Chinese/English text. Try `--lang en` for English-only material.
5. Start with default filtering. Lower `--min-score` or add `--keep-low` if the image is noisy, blurry, or UI-heavy.
6. Review the extracted lines and remove obvious interface chrome manually before presenting a cleaned summary to the user.

## Output modes

- `--format text`: Return joined text only.
- `--format lines`: Return `score<TAB>text` per OCR line.
- `--format json`: Return structured OCR output with per-line confidence.

## Notes

- Expect the first run to take longer because PaddleOCR downloads models.
- Pass multiple input paths in one command to batch OCR several files.
- Use `--output` when the result should be saved for later use.
