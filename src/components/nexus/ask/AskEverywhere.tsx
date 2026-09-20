"use client";
// CR08 2.3: mount once in AppShell. Renders the floating launcher and the
// panel, and installs the Ctrl/Cmd+K shortcut (capture phase, so it wins over
// the search field's older binding).
//
// Only one instance renders at a time. Instances register in a small live
// registry; the first non-fallback one is primary, and when it unmounts the
// next takes over, so a page that mounts <AskEverywhere fallback /> for
// testing never doubles the panel and never removes it either.
import * as React from "react";
import { AskLauncher } from "./AskLauncher";
import { AskPanel } from "./AskPanel";
import { askPanel, hydrateAskPanel } from "./panel-store";

type Entry = { id: symbol; fallback: boolean };
let entries: Entry[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function primaryId(): symbol | null {
  return (entries.find((e) => !e.fallback) ?? entries[0])?.id ?? null;
}

export function AskEverywhere({
  fallback = false,
}: {
  /** renders only while no other instance exists (dev test pages) */
  fallback?: boolean;
}) {
  const idRef = React.useRef<symbol | null>(null);
  if (!idRef.current) idRef.current = Symbol("ask-everywhere");
  const id = idRef.current;

  React.useEffect(() => {
    entries = [...entries, { id, fallback }];
    notify();
    // CR08 Phase A: the mirrored thread is restored after hydration, never at
    // module load, so the first client render matches the server's snapshot.
    hydrateAskPanel();
    return () => {
      entries = entries.filter((e) => e.id !== id);
      notify();
    };
  }, [id, fallback]);

  const primary = React.useSyncExternalStore(
    subscribe,
    () => primaryId() === id,
    () => false
  );

  React.useEffect(() => {
    if (!primary) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        // opens with the composer focused; already open: just refocus it
        if (askPanel.get().open) askPanel.focusComposer();
        else askPanel.open({ focus: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [primary]);

  if (!primary) return null;
  return (
    <>
      <AskLauncher />
      <AskPanel />
    </>
  );
}
