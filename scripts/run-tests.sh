#!/usr/bin/env bash
# Run extension tests and write summary to test-results.txt
set -e
cd "$(dirname "$0")/.."
RESULTS_FILE="${1:-test-results.txt}"

{
  echo "=== Astro Analytics test run $(date '+%Y-%m-%dT%H:%M:%S') ==="
  echo ""
  echo "--- Unit tests (Vitest) ---"
  pnpm test 2>&1 || true
  echo ""
  echo "--- Compile ---"
  pnpm run compile 2>&1 || true
  echo ""
  echo "--- Integration tests (VS Code) ---"
  pnpm run test:integration 2>&1 || true
  echo ""
  echo "=== End ==="
} | tee "$RESULTS_FILE"
