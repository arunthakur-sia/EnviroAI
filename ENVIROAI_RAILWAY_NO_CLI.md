# EnviroAI: Railway without the CLI (addendum for Claude Code)

Context: the Railway CLI cannot run on this managed Windows laptop (its executable is blocked by Application Control and exits silently). Deployment will use GitHub for the code and a one-time, token-protected restore page inside EnviroAI for the data. Apply this after `ENVIROAI_RAILWAY_READINESS.md`. Run unattended except where a step says to ask the user.

## 1. One-time restore page (no login, protected by a setup token)
1. The page `/setup/restore` and its API `/api/setup/restore/*` exist only when the environment variable `SETUP_TOKEN` is set (at least 32 characters). When it is not set, both return 404.
2. The page works even when the database is empty (no login needed). It asks for the setup token, compared in constant time; five wrong attempts lock the page for 15 minutes.
3. Upload in chunks so large bundles survive slow office connections and proxy limits:
   - `POST /api/setup/restore/start` with the file name, size, and SHA-256 of the whole file (computed in the browser with Web Crypto, reading the file in slices).
   - `POST /api/setup/restore/chunk` with the chunk index and an 8 MB chunk, appended to `${DATA_DIR}/import/enviroai-data.tar.gz.part`; each chunk retried up to 3 times; the page can resume after a refresh from the last received chunk.
   - `POST /api/setup/restore/finish` verifies the size and SHA-256, then renames the file to `${DATA_DIR}/import/enviroai-data.tar.gz`.
4. The page shows a clear progress bar (MB sent of total, percentage), then a success message in both languages: "Upload complete. Now go to Railway, delete the SETUP_TOKEN variable, and click Deploy. EnviroAI will restart with your data."
5. The boot script from the readiness file already restores the bundle on the next start and renames it to `.done`. Confirm it also removes any leftover `.part` file.
6. Waiting state: if the database has no users at startup, every normal page shows a simple branded screen "EnviroAI is being set up. Please check back in a few minutes." instead of an error; `/api/health` still returns 200 so Railway keeps the service running.
7. Add `SETUP_TOKEN=<new random 40-character value>` as the last line of `railway-variables.txt`, and print the token for the user at the end with the note that they will type it into the restore page.

## 2. Push the code to GitHub
1. Check `git status`: nothing from `data/`, no `.env*`, no `*.tar.gz`, no `railway-variables.txt`, no `node_modules/`, no `.next/`. Check no single file is larger than 95 MB (GitHub rejects files over 100 MB); if one is, move it out of the repo and record it.
2. Ask the user for the URL of the empty private GitHub repository they created (for example `https://github.com/<user>/enviroai.git`).
3. `git init` (if needed), `git add .`, `git commit -m "EnviroAI ready for Railway"`, `git branch -M main`, `git remote add origin <url>`, `git push -u origin main`.
4. If the push needs credentials and you cannot answer the prompt, stop and tell the user to run exactly `git push -u origin main` in their own terminal in the project folder, and to paste a GitHub personal access token when asked for the password. Do not store the token in `.git/config`.
5. After the push, confirm on the terminal that `main` is up to date with `origin/main`.

## 3. Local proof
Repeat the local simulation from the readiness file with an EMPTY `DATA_DIR` and `SETUP_TOKEN` set: open `/setup/restore`, upload `enviroai-data.tar.gz`, restart with `npm run start:railway`, confirm the data is restored and you can log in. Then remove the test folder. Finish with the message "Ready for GitHub and Railway" and the setup token.
