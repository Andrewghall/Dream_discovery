#!/usr/bin/env bash
set -euo pipefail

# One-shot backup for DREAM:
# - Code snapshot (full folder copy)
# - Git snapshot metadata (branch + commit + status)
# - Prisma schema/migrations copy
# - Supabase/Postgres DB dump (pg_dump custom format)
# - Local env files copy (if present)
# - Optional Supabase Storage export placeholders
#
# Usage:
#   SUPABASE_DB_URL="postgresql://..." ./scripts/backup-dream.sh
# or:
#   ./scripts/backup-dream.sh --db-url "postgresql://..."
#
# Optional:
#   BACKUP_ROOT="/Users/andrewhall/Dream_backups" ./scripts/backup-dream.sh
#   ./scripts/backup-dream.sh --export-storage --project-ref <ref>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_NAME="$(basename "${REPO_ROOT}")"
TIMESTAMP="$(date +%F_%H%M%S)"
BACKUP_ROOT="${BACKUP_ROOT:-/Users/andrewhall/Dream_backups}"
RUN_DIR="${BACKUP_ROOT}/${PROJECT_NAME}_${TIMESTAMP}"

DB_URL="${SUPABASE_DB_URL:-}"
EXPORT_STORAGE=0
PROJECT_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-url)
      DB_URL="${2:-}"
      shift 2
      ;;
    --export-storage)
      EXPORT_STORAGE=1
      shift
      ;;
    --project-ref)
      PROJECT_REF="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${RUN_DIR}"
echo "Backup directory: ${RUN_DIR}"

echo "==> Capturing git metadata"
git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD > "${RUN_DIR}/git_branch.txt"
git -C "${REPO_ROOT}" rev-parse HEAD > "${RUN_DIR}/git_commit.txt"
git -C "${REPO_ROOT}" status --short > "${RUN_DIR}/git_status_short.txt" || true
git -C "${REPO_ROOT}" tag --list > "${RUN_DIR}/git_tags.txt" || true

echo "==> Copying code snapshot"
CODE_TAR="${RUN_DIR}/${PROJECT_NAME}_code.tar.gz"
tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='public/PAMWellness/_next' \
  -czf "${CODE_TAR}" \
  -C "$(dirname "${REPO_ROOT}")" \
  "${PROJECT_NAME}"

echo "==> Copying Prisma schema and migrations"
mkdir -p "${RUN_DIR}/prisma"
if [[ -d "${REPO_ROOT}/prisma" ]]; then
  cp -a "${REPO_ROOT}/prisma/." "${RUN_DIR}/prisma/"
fi
if [[ -f "${REPO_ROOT}/prisma.config.ts" ]]; then
  cp -a "${REPO_ROOT}/prisma.config.ts" "${RUN_DIR}/"
fi

echo "==> Copying env files if present"
mkdir -p "${RUN_DIR}/env"
for env_file in ".env" ".env.local" ".env.production"; do
  if [[ -f "${REPO_ROOT}/${env_file}" ]]; then
    cp -a "${REPO_ROOT}/${env_file}" "${RUN_DIR}/env/${env_file}"
  fi
done

if [[ -n "${DB_URL}" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    echo "==> Creating database dump"
    pg_dump "${DB_URL}" \
      --format=custom \
      --no-owner \
      --no-privileges \
      --file "${RUN_DIR}/supabase_db.dump"
  else
    echo "WARNING: pg_dump not found, skipping DB dump" | tee -a "${RUN_DIR}/warnings.txt"
  fi
else
  echo "WARNING: SUPABASE_DB_URL/--db-url not provided, skipping DB dump" | tee -a "${RUN_DIR}/warnings.txt"
fi

if [[ "${EXPORT_STORAGE}" -eq 1 ]]; then
  echo "==> Storage export requested"
  mkdir -p "${RUN_DIR}/storage"
  cat > "${RUN_DIR}/storage/README.txt" <<EOF
Storage object export is not included in pg_dump.

Run one of these workflows:
1) Supabase CLI/scripted bucket export per bucket
2) API-based object listing + download

Project ref passed: ${PROJECT_REF}
EOF
fi

cat > "${RUN_DIR}/BACKUP_SUMMARY.txt" <<EOF
Project: ${PROJECT_NAME}
Created at: ${TIMESTAMP}
Repo path: ${REPO_ROOT}
Branch: $(cat "${RUN_DIR}/git_branch.txt")
Commit: $(cat "${RUN_DIR}/git_commit.txt")

Contents:
- Code archive: ${CODE_TAR}
- Git metadata: branch/commit/status/tags
- Prisma files: prisma/ + prisma.config.ts
- Env copies (if present): env/
- DB dump (if created): supabase_db.dump
- Storage notes (if requested): storage/README.txt
EOF

echo
echo "Backup complete."
echo "Path: ${RUN_DIR}"
echo "Summary: ${RUN_DIR}/BACKUP_SUMMARY.txt"
