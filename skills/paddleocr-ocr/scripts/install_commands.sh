#!/bin/zsh
set -euo pipefail

TARGET_DIR="${1:-$HOME/.local/bin}"
SKILL_SCRIPT="/Users/huli/.openclaw/workspace/skills/paddleocr-ocr/scripts/extract_ocr.py"

mkdir -p "$TARGET_DIR"

cat > "$TARGET_DIR/ocr" <<EOF
#!/bin/zsh
set -euo pipefail
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
export PYTHONWARNINGS=ignore
exec python3 "$SKILL_SCRIPT" "\$@"
EOF

cat > "$TARGET_DIR/ocr-chat" <<EOF
#!/bin/zsh
set -euo pipefail
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
export PYTHONWARNINGS=ignore
exec python3 "$SKILL_SCRIPT" --chat-clean "\$@"
EOF

chmod +x "$TARGET_DIR/ocr" "$TARGET_DIR/ocr-chat"

echo "Installed commands:"
echo "- $TARGET_DIR/ocr"
echo "- $TARGET_DIR/ocr-chat"
