#!/bin/bash
# Installs npm dependencies in Claude Code cloud sessions, so the Neon driver,
# lint and build work from the first prompt.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm ci --no-audit --no-fund
