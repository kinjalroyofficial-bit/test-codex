#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_FILE="${ROOT_DIR}/.repo-remote"

if [[ ! -f "${REMOTE_FILE}" ]]; then
  echo "Missing ${REMOTE_FILE}. Add your repository URL there first." >&2
  exit 1
fi

REMOTE_URL="$(tr -d '\r' < "${REMOTE_FILE}" | sed -n '1p')"
if [[ -z "${REMOTE_URL}" ]]; then
  echo "${REMOTE_FILE} is empty. Put your repository URL on the first line." >&2
  exit 1
fi

# Optional token support for fresh environments without stored credentials.
# Example: export GIT_REMOTE_TOKEN=ghp_xxx
if [[ -n "${GIT_REMOTE_TOKEN:-}" && "${REMOTE_URL}" == https://github.com/* ]]; then
  AUTH_REMOTE_URL="https://${GIT_REMOTE_TOKEN}@${REMOTE_URL#https://}"
else
  AUTH_REMOTE_URL="${REMOTE_URL}"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${AUTH_REMOTE_URL}"
  ACTION="Updated"
else
  git remote add origin "${AUTH_REMOTE_URL}"
  ACTION="Added"
fi

echo "${ACTION} origin remote."
git remote -v
