/* eslint-disable no-console */
// CR08 2.3 smoke: Ask NPC everywhere. The recent-conversations list, the
// contextItem plumbing through the analyst stream, the messages endpoint
// with its ownership and sharing rules, the i18n namespace, and the item
// pages that mount the context marker. Wired into scripts/smoke.ts by the
// coordinator; uses a Contributor cookie and the Super Admin cookie.
import fs from "node:fs";
import path from "node:path";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = {
  base: string;
  cookie: string;
  adminCookie: string;
  db: import("@libsql/client").Client;
};

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function keysAt(obj: Record<string, unknown>, dotted: string): string[] {
  const node = dotted.split(".").reduce<unknown>((acc, k) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined;
  }, obj);
  return node && typeof node === "object" ? Object.keys(node as object) : [];
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const get = (p: string, c?: string) =>
    fetch(base + p, { headers: c ? { cookie: c } : {}, redirect: "manual" });
  const json = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  /* recent conversations for the panel */
  const list = await get("/api/v1/conversations", cookie);
  const listJson = await json(list);
  check("ask panel: GET /conversations for a contributor", list.status === 200 && Array.isArray(listJson?.data));
  const anon = await get("/api/v1/conversations");
  check("ask panel: GET /conversations refused without a session", anon.status === 401);

  /* contextItem validation */
  const bad = await fetch(base + "/api/v1/ai/analyst", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ message: "What did it deliver?", locale: "en", contextItem: { kind: "project", id: "x" } }),
  });
  check("ask panel: analyst rejects a contextItem without a title", bad.status === 400, String(bad.status));

  /* a real send with the page item attached */
  const project = await db.execute(
    "select id, code, title_en from strategy_nodes where node_type = 'project' and code is not null order by code limit 1"
  );
  const p = project.rows[0] as unknown as { id: string; code: string; title_en: string } | undefined;
  check("ask panel: a seeded project exists for the context", Boolean(p));
  let conversationId: string | null = null;
  if (p) {
    const res = await fetch(base + "/api/v1/ai/analyst", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        message: `What did ${p.code} deliver?`,
        locale: "en",
        context: { type: "node", id: p.id },
        contextItem: { kind: "project", id: p.id, code: p.code, title: p.title_en },
      }),
    });
    const text = res.ok ? await res.text() : "";
    const meta = /event: meta\ndata: (.*)\n/.exec(text);
    const final = /event: final\ndata: (.*)\n/.exec(text);
    conversationId = meta ? (JSON.parse(meta[1]).conversationId as string) : null;
    check("ask panel: analyst stream opens with meta", res.status === 200 && Boolean(conversationId));
    check("ask panel: analyst stream reaches final with the item attached", Boolean(final));
    if (final) {
      const parsed = JSON.parse(final[1]) as { markdown: string; citations: unknown[] };
      check("ask panel: the answer has text", typeof parsed.markdown === "string" && parsed.markdown.length > 20);
    }
  }

  if (conversationId) {
    const audit = await db.execute({
      sql: "select meta_json from audit_log where action = 'ask' and resource_id = ? order by created_at desc limit 1",
      args: [conversationId],
    });
    const meta = String(audit.rows[0]?.meta_json ?? "");
    check("ask panel: the audit row records the context item", /"contextItem":"project:/.test(meta), meta.slice(0, 80));

    /* the messages endpoint */
    const mine = await get(`/api/v1/conversations/${conversationId}/messages`, cookie);
    const mineJson = await json(mine);
    const turns = (mineJson?.data?.turns ?? []) as { role: string; content: string }[];
    check("ask panel: owner reads the conversation turns", mine.status === 200 && turns.length >= 2, String(turns.length));
    check("ask panel: turns start with the question", turns[0]?.role === "user" && turns[1]?.role === "assistant");
    check("ask panel: messages endpoint says isOwner", mineJson?.data?.isOwner === true);
    const other = await get(`/api/v1/conversations/${conversationId}/messages`, adminCookie);
    check("ask panel: another user gets 404 on a private conversation", other.status === 404, String(other.status));
    const noSession = await get(`/api/v1/conversations/${conversationId}/messages`);
    check("ask panel: messages refused without a session", noSession.status === 401);
    const counted = await db.execute({
      sql: "select count(*) as c from ai_messages where conversation_id = ?",
      args: [conversationId],
    });
    check("ask panel: two messages stored", Number(counted.rows[0]?.c) === 2, String(counted.rows[0]?.c));

    /* sharing opens it at the viewer's clearance */
    await fetch(`${base}/api/v1/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ share: true }),
    });
    const shared = await get(`/api/v1/conversations/${conversationId}/messages`, adminCookie);
    const sharedJson = await json(shared);
    check("ask panel: a shared conversation opens for a colleague", shared.status === 200 && sharedJson?.data?.isOwner === false);

    /* cleanup */
    const del = await fetch(`${base}/api/v1/conversations/${conversationId}`, { method: "DELETE", headers: { cookie } });
    const gone = await get(`/api/v1/conversations/${conversationId}/messages`, cookie);
    check("ask panel: deleted conversation is gone", del.status === 200 && gone.status === 404);
  }
  const missing = await get("/api/v1/conversations/does-not-exist/messages", cookie);
  check("ask panel: unknown conversation is 404", missing.status === 404);

  /* i18n: the namespace with every kind in both languages */
  const en = readJson(path.join(process.cwd(), "messages", "en.json"));
  const ar = readJson(path.join(process.cwd(), "messages", "ar.json"));
  const nudgeEn = keysAt(en, "askEverywhere.nudge");
  const nudgeAr = keysAt(ar, "askEverywhere.nudge");
  check("ask panel: nudge wording for 15 kinds in English", nudgeEn.length === 15, String(nudgeEn.length));
  check("ask panel: nudge wording for 15 kinds in Arabic", nudgeAr.length === 15 && nudgeAr.every((k) => nudgeEn.includes(k)));
  check(
    "ask panel: three suggestions per kind in both languages",
    nudgeEn.every((k) => keysAt(en, `askEverywhere.suggestions.${k}`).length === 3 && keysAt(ar, `askEverywhere.suggestions.${k}`).length === 3)
  );

  /* the item pages that mount the context marker still render */
  const doc = await db.execute("select id from documents where classification_level <= 2 order by created_at desc limit 1");
  const ind = await db.execute("select id from indicators limit 1");
  const lesson = await db.execute("select id from lessons where classification_level <= 2 limit 1");
  const pages: [string, string | undefined][] = [
    ["strategy", p?.id],
    ["vault", doc.rows[0]?.id as string | undefined],
    ["statistics", ind.rows[0]?.id as string | undefined],
    ["lessons", lesson.rows[0]?.id as string | undefined],
  ];
  for (const [area, id] of pages) {
    if (!id) {
      check(`ask panel: /${area}/[id] marker page`, false, "no seeded row");
      continue;
    }
    const res = await get(`/en/${area}/${id}`, cookie);
    check(`ask panel: /${area}/[id] renders with the context marker`, res.status === 200, String(res.status));
  }
}
