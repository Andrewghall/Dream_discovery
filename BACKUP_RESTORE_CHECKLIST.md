# DREAM Backup And Restore Checklist

## 1. Create Backup

### 1.1 Run one-shot backup script

```bash
cd /Users/andrewhall/Dream_discovery
chmod +x ./scripts/backup-dream.sh
SUPABASE_DB_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require" ./scripts/backup-dream.sh
```

Optional storage note bundle:

```bash
SUPABASE_DB_URL="postgresql://..." ./scripts/backup-dream.sh --export-storage --project-ref your-project-ref
```

### 1.2 What gets backed up

- Code archive (excluding `.git`, `node_modules`, `.next`, `public/PAMWellness/_next`)
- Git metadata (branch, commit, status, tags)
- Prisma files (`prisma/`, `prisma.config.ts`)
- Env files if present (`.env`, `.env.local`, `.env.production`)
- Supabase/Postgres database dump (`supabase_db.dump`) when `SUPABASE_DB_URL` is provided

## 2. Verify Backup

```bash
ls -lah /Users/andrewhall/Dream_backups
LATEST="$(ls -dt /Users/andrewhall/Dream_backups/Dream_discovery_* | head -1)"
cat "${LATEST}/BACKUP_SUMMARY.txt"
```

Check DB dump exists and is non-trivial in size:

```bash
ls -lah "${LATEST}/supabase_db.dump"
```

## 3. Restore (Code + Prisma + Env)

```bash
LATEST="$(ls -dt /Users/andrewhall/Dream_backups/Dream_discovery_* | head -1)"
mkdir -p /Users/andrewhall/restore_test
tar -xzf "${LATEST}/Dream_discovery_code.tar.gz" -C /Users/andrewhall/restore_test
```

If needed, copy env files back:

```bash
cp -a "${LATEST}/env/." /Users/andrewhall/restore_test/Dream_discovery/ 2>/dev/null || true
```

## 4. Restore Database To Supabase/Postgres

Use `pg_restore` with a target connection string:

```bash
LATEST="$(ls -dt /Users/andrewhall/Dream_backups/Dream_discovery_* | head -1)"
pg_restore \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --dbname "postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require" \
  "${LATEST}/supabase_db.dump"
```

## 5. Storage Objects

`pg_dump` does not include Supabase Storage object binaries.
Back up buckets separately using Supabase tooling or API scripts.

## 6. Quick Recovery Validation

After restore:

1. Run app boot checks and migrations status.
2. Confirm critical tables have expected row counts.
3. Test one workshop end-to-end flow.
4. Confirm guidance state and live events are readable.
