#!/usr/bin/env bash
# DevOps level 1: rewind history to find the exact commit that broke the build or tests.
# Usage: scripts/find-breaking-commit.sh <last good tag or commit> [bad commit, default HEAD]
# Example: scripts/find-breaking-commit.sh live-2026.10.20-14
# Each step checks out a commit and runs the same checks CI runs. Your branch is restored at the end.
set -euo pipefail
good="${1:?give the last good tag or commit, e.g. live-2026.10.20-14 (git tag -l 'live-*')}"
bad="${2:-HEAD}"
if [ -n "$(git status --porcelain)" ]; then echo "Commit or stash your changes first."; exit 1; fi

git bisect start "$bad" "$good"
trap 'git bisect reset >/dev/null 2>&1 || true' EXIT
# Exit code 125 tells bisect to skip a commit whose dependencies won't install.
git bisect run bash -c '
  bun install --frozen-lockfile >/dev/null 2>&1 || exit 125
  npx tsc --noEmit && npx vitest run && npx vite build >/dev/null && node scripts/check-bundle.mjs --strict
'
git bisect log | grep "first bad commit" || true
