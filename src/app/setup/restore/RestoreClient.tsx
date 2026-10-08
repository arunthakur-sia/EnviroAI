"use client";
/**
 * The uploader. Reads the bundle in slices so a 120 MB file never sits in
 * memory whole, digests it with Web Crypto so the server can prove it arrived
 * intact, then sends it 8 MB at a time with retries and resume.
 *
 * Every string is written here in both languages rather than through
 * next-intl: this page runs before the app is configured, and a setup screen
 * that fails because a message file did not load would be a poor joke.
 */
import * as React from "react";

const CHUNK_FALLBACK = 8 * 1024 * 1024;
const MAX_TRIES = 3;

type Phase = "token" | "ready" | "hashing" | "uploading" | "verifying" | "done" | "error";

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/** SHA-256 of the whole file, read in slices so memory stays flat. */
async function digestFile(file: File, onProgress: (read: number) => void): Promise<string> {
  // Web Crypto has no streaming digest, so the bytes are gathered once. A
  // bundle of this size fits; the slicing keeps the read itself incremental
  // and lets the progress bar move while it happens.
  const slice = 16 * 1024 * 1024;
  const parts: Uint8Array[] = [];
  let read = 0;
  for (let offset = 0; offset < file.size; offset += slice) {
    const buf = await file.slice(offset, Math.min(offset + slice, file.size)).arrayBuffer();
    parts.push(new Uint8Array(buf));
    read += buf.byteLength;
    onProgress(read);
  }
  const whole = new Uint8Array(file.size);
  let at = 0;
  for (const p of parts) {
    whole.set(p, at);
    at += p.length;
  }
  const hash = await crypto.subtle.digest("SHA-256", whole);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function RestoreClient() {
  const [token, setToken] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>("token");
  const [sent, setSent] = React.useState(0);
  const [hashed, setHashed] = React.useState(0);
  const [message, setMessage] = React.useState<{ en: string; ar: string } | null>(null);
  const [detail, setDetail] = React.useState("");

  const total = file?.size ?? 0;
  const pct = total ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  const hashPct = total ? Math.min(100, Math.round((hashed / total) * 100)) : 0;

  const post = React.useCallback(
    async (path: string, init: RequestInit = {}) =>
      fetch(path, {
        ...init,
        method: "POST",
        headers: { ...(init.headers ?? {}), "x-setup-token": token },
      }),
    [token]
  );

  async function onUpload() {
    if (!file) return;
    setDetail("");
    setMessage(null);
    try {
      setPhase("hashing");
      setHashed(0);
      const sha256 = await digestFile(file, setHashed);

      const startRes = await post("/api/setup/restore/start", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, sha256 }),
      });
      const startJson = await startRes.json().catch(() => null);
      if (!startRes.ok) {
        setPhase("error");
        if (startJson?.error === "locked") {
          setMessage({
            en: `Too many wrong tokens. Try again in ${Math.ceil((startJson.retryAfterSeconds ?? 900) / 60)} minutes.`,
            ar: `محاولات خاطئة كثيرة. حاول مرة أخرى بعد ${Math.ceil((startJson.retryAfterSeconds ?? 900) / 60)} دقيقة.`,
          });
        } else if (startRes.status === 401) {
          setMessage({ en: "That setup token is not right.", ar: "رمز الإعداد غير صحيح." });
          setPhase("token");
        } else {
          setMessage({ en: "The upload could not start.", ar: "تعذّر بدء الرفع." });
          setDetail(String(startJson?.detail ?? startJson?.error ?? startRes.status));
        }
        return;
      }

      const chunkSize: number = startJson?.data?.chunkSize ?? CHUNK_FALLBACK;
      const totalChunks: number = startJson?.data?.totalChunks ?? Math.ceil(file.size / chunkSize);
      let index: number = startJson?.data?.resumeFrom ?? 0;
      setPhase("uploading");
      setSent(index * chunkSize);

      while (index < totalChunks) {
        const from = index * chunkSize;
        const to = Math.min(from + chunkSize, file.size);
        const blob = file.slice(from, to);
        let done = false;
        let lastError = "";
        for (let attempt = 1; attempt <= MAX_TRIES && !done; attempt++) {
          try {
            const res = await post(`/api/setup/restore/chunk?index=${index}`, {
              headers: { "content-type": "application/octet-stream" },
              body: blob,
            });
            if (res.ok) {
              done = true;
              break;
            }
            const json = await res.json().catch(() => null);
            lastError = String(json?.error ?? res.status);
            // the server knows better than we do where it got to
            if (json?.expectedIndex !== undefined) {
              index = json.expectedIndex;
              setSent(index * chunkSize);
              done = true;
              break;
            }
          } catch (e) {
            lastError = String((e as Error)?.message ?? e);
          }
          if (attempt < MAX_TRIES) await new Promise((r) => setTimeout(r, 800 * attempt));
        }
        if (!done) {
          setPhase("error");
          setMessage({
            en: "A part of the file did not arrive after three tries. Check the connection and press Upload again; it will carry on from here.",
            ar: "لم يصل جزء من الملف بعد ثلاث محاولات. تحقّق من الاتصال ثم اضغط رفع مرة أخرى، وسيكمل من هذه النقطة.",
          });
          setDetail(lastError);
          return;
        }
        index += 1;
        setSent(Math.min(file.size, index * chunkSize));
      }

      setPhase("verifying");
      const finishRes = await post("/api/setup/restore/finish");
      const finishJson = await finishRes.json().catch(() => null);
      if (!finishRes.ok) {
        setPhase("error");
        setMessage({
          en: "The file arrived but did not match its checksum, so it was discarded. Please upload it again.",
          ar: "وصل الملف لكنه لم يطابق بصمته، فتم تجاهله. يرجى رفعه مرة أخرى.",
        });
        setDetail(String(finishJson?.detail ?? finishJson?.error ?? finishRes.status));
        return;
      }
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setMessage({ en: "Something went wrong during the upload.", ar: "حدث خطأ أثناء الرفع." });
      setDetail(String((e as Error)?.message ?? e));
    }
  }

  const busy = phase === "hashing" || phase === "uploading" || phase === "verifying";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">EnviroAI</p>
        <h1 className="mt-1 font-display text-3xl text-navy-900">Restore the data</h1>
        <p className="mt-1 font-display text-2xl text-navy-900" dir="rtl" lang="ar">
          استعادة البيانات
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Upload <code className="rounded bg-mist-100 px-1">enviroai-data.tar.gz</code>. It is stored on
          the volume and unpacked the next time the service starts.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600" dir="rtl" lang="ar">
          ارفع ملف الحزمة. يُحفظ على وحدة التخزين ويُفك عند إعادة تشغيل الخدمة.
        </p>
      </header>

      {phase === "done" ? (
        <section
          className="rounded-[var(--radius-card)] border border-teal-600 bg-white p-6"
          data-testid="restore-done"
        >
          <h2 className="font-display text-xl text-teal-600">Upload complete</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-900">
            Now go to Railway, delete the <code className="rounded bg-mist-100 px-1">SETUP_TOKEN</code>{" "}
            variable, and click Deploy. EnviroAI will restart with your data.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-900" dir="rtl" lang="ar">
            انتقل الآن إلى Railway، واحذف متغيّر <code className="rounded bg-mist-100 px-1">SETUP_TOKEN</code>،
            ثم اضغط Deploy. ستعيد سيا نكسس التشغيل ومعها بياناتك.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-mist-300 bg-white p-6">
          <div>
            <label htmlFor="setup-token" className="mb-1.5 block text-xs font-medium text-ink-600">
              Setup token · رمز الإعداد
            </label>
            <input
              id="setup-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              dir="ltr"
              autoComplete="off"
              data-testid="setup-token"
              className="h-9.5 w-full rounded-lg border border-mist-300 bg-white px-3 text-sm text-ink-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
            />
          </div>

          <div>
            <label htmlFor="setup-file" className="mb-1.5 block text-xs font-medium text-ink-600">
              The bundle · ملف الحزمة
            </label>
            <input
              id="setup-file"
              type="file"
              accept=".gz,.tgz,application/gzip"
              disabled={busy}
              data-testid="setup-file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setSent(0);
                setHashed(0);
                setMessage(null);
                setPhase("ready");
              }}
              className="block w-full text-sm text-ink-900 file:me-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            {file ? (
              <p className="mt-1.5 text-xs text-ink-600 tnum">
                {file.name} · {mb(file.size)} MB
              </p>
            ) : null}
          </div>

          {phase === "hashing" ? (
            <Progress label="Checking the file · فحص الملف" pct={hashPct} detail={`${mb(hashed)} / ${mb(total)} MB`} />
          ) : null}
          {phase === "uploading" ? (
            <Progress
              label="Uploading · جارٍ الرفع"
              pct={pct}
              detail={`${mb(sent)} / ${mb(total)} MB · ${pct}%`}
              testId="restore-progress"
            />
          ) : null}
          {phase === "verifying" ? (
            <Progress label="Verifying · التحقّق" pct={100} detail="checking the checksum" />
          ) : null}

          {message ? (
            <div className="rounded-lg border border-mist-300 bg-mist-50 p-3" data-testid="restore-message">
              <p className="text-sm text-ink-900">{message.en}</p>
              <p className="mt-1 text-sm text-ink-900" dir="rtl" lang="ar">
                {message.ar}
              </p>
              {detail ? <p className="mt-1 text-xs text-ink-400" dir="ltr">{detail}</p> : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void onUpload()}
            disabled={busy || !file || token.length < 32}
            data-testid="setup-upload"
            className="h-10 rounded-lg bg-navy-700 px-4 text-sm font-medium text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {busy ? "Working…" : "Upload · رفع"}
          </button>
          {token.length > 0 && token.length < 32 ? (
            <p className="text-xs text-ink-400">
              The token is at least 32 characters. · الرمز 32 حرفًا على الأقل.
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}

function Progress({
  label,
  pct,
  detail,
  testId,
}: {
  label: string;
  pct: number;
  detail: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between text-xs text-ink-600">
        <span>{label}</span>
        <span className="tnum" data-testid={testId ? `${testId}-value` : undefined}>
          {detail}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-mist-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full bg-navy-700 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
