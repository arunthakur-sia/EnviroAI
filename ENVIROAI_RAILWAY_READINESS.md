# EnviroAI: Railway Readiness (for Claude Code)

Goal: prepare the EnviroAI codebase to run on Railway as ONE service with ONE volume mounted at `/app/data`, then produce a data bundle and a variables file for the user. Do not deploy anything yourself unless the user asks. Run unattended, record decisions in `DECISIONS.md`, and finish with the checklist in Section 9.

## 1. One data folder, configurable
- Every runtime path (SQLite database, uploads, deliverables, podcasts, reports, local model cache, temporary files) must be resolved from `process.env.DATA_DIR`, defaulting to `./data` locally. Search the whole codebase for hardcoded `./data`, `data/`, `process.cwd()` joins, and fix them through one helper `src/server/paths.ts`.
- Nothing may write outside `DATA_DIR` at runtime except the OS temp folder.

## 2. Health endpoint
- Add `GET /api/health`: opens the database, runs `SELECT 1`, returns `{ ok: true, version, dataDir }` with status 200, or 503 on failure. No authentication; exclude it from the auth middleware. No AI calls.

## 3. Boot script (runs at container start, because the volume is not mounted during build or pre-deploy)
Create `scripts/boot.mjs` (plain JavaScript, runtime dependencies only, no `tsx`):
1. Ensure `DATA_DIR` and its subfolders exist.
2. **Restore bundle once**: if `${DATA_DIR}/import/enviroai-data.tar.gz` exists, extract it into `DATA_DIR` with the `tar` npm package (pure JS; add it as a dependency), overwriting existing files, then rename the bundle to `enviroai-data.tar.gz.done`. Log what was restored.
3. Run database migrations with the Drizzle runtime migrator (`drizzle-orm/libsql/migrator`), idempotent.
4. **Optional first seed**: only if `SEED_ON_EMPTY=true` AND the database has no users, run the seed from the committed `/sources` folder with no network fetching. Otherwise never seed.
5. Apply SQLite pragmas as in Phase A (WAL, synchronous NORMAL).
6. Exit 0 so the start command continues.

## 4. Scripts in package.json
- `"engines": { "node": "22.x" }`
- `"build": "next build"` (unchanged if already so)
- `"start:railway": "node scripts/boot.mjs && next start -H 0.0.0.0"` (Next reads the `PORT` variable that Railway provides)
- `"data:export": ...` a script that: checks the app is not running (warn if the database is locked), runs `PRAGMA wal_checkpoint(TRUNCATE)`, and writes `enviroai-data.tar.gz` in the project root containing everything in `DATA_DIR` except `models/`, `screenshots/`, and temporary files. Print the file size at the end.
- Make sure Playwright, bundle analyzer, Vitest, and other test tools are in `devDependencies`, and that no install step downloads browsers when `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## 5. railway.json (project root)
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK", "buildCommand": "npm run build" },
  "deploy": {
    "startCommand": "npm run start:railway",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```
Validate it against the schema at `https://railway.com/railway.schema.json`; if a field name differs, use the schema's name and record it.

## 6. Production settings
- Session cookie `secure: true` when `NODE_ENV=production`; trust the proxy headers.
- Absolute URLs (invitation links, deep links in reports and messages) use `APP_URL`.
- If server actions are used, allow the origin from `APP_URL`.
- Send `X-Robots-Tag: noindex, nofollow` on all responses and serve a `robots.txt` that disallows everything.
- Scheduled signal scans run only when `SCAN_SCHEDULE_ENABLED=true`; "Refresh signals" on demand always works.
- `TZ` respected for week boundaries (Knowledge of the Week, leaderboard periods).
- The local embedding model must never load when `VOYAGE_API_KEY` is set, and never at build time.
- Report page thumbnails: if LibreOffice is not installed, skip silently (already designed); the docx itself must still generate.

## 7. Ignore files
- `.gitignore` and a new `.railwayignore` must both exclude: `node_modules/`, `.next/`, `data/`, `.env*`, `*.tar.gz`, `railway-variables.txt`, `data/screenshots/`, `test-results/`, `playwright-report/`.
- `/sources` stays included (the public documents used by the seed).

## 8. Files for the user
1. Run `npm run data:export` and confirm `enviroai-data.tar.gz` exists.
2. Create `railway-variables.txt` in the project root (ignored by git and Railway) with the values read from `.env.local`, in this exact format, one per line:
```
NODE_ENV=production
DATA_DIR=/app/data
APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
SESSION_PASSWORD=<generate a new random 48-character value>
ANTHROPIC_API_KEY=<from .env.local>
VOYAGE_API_KEY=<from .env.local>
ELEVENLABS_API_KEY=<from .env.local>
ELEVENLABS_VOICE_MARIAM=<from .env.local or from Settings in the local database>
ELEVENLABS_VOICE_HAMAD=<from .env.local or from Settings in the local database>
TZ=Asia/Riyadh
SCAN_SCHEDULE_ENABLED=false
SKIP_INDICES_FETCH=1
SKIP_CR07_FETCH=1
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
NEXT_TELEMETRY_DISABLED=1
```
Use the real variable names the code expects (check `.env.example`); if the session secret variable has another name, use that name.
3. Report whether the local database embeddings were created with Voyage (`embedding_model` column). If not, say so clearly: the user must run "Re-embed all" in Settings after deployment.

## 9. Local proof before finishing
1. `npm run typecheck`, `npm run lint`, `npm run build` pass.
2. Simulate Railway locally: set `DATA_DIR` to a new empty folder `./railway-test-data`, copy the bundle to `./railway-test-data/import/`, run `npm run start:railway` with `PORT=4000`, open `http://localhost:4000/api/health` (must be OK), log in as the Super Admin account, open Home, Institutional Memory, and Ask EnviroAI. Stop the server and delete `./railway-test-data`.
3. Print a short summary for the user: bundle size, whether embeddings are Voyage, and "Ready for Railway".
