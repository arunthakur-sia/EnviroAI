"use client";
// CR08 2.3: the Ask EnviroAI panel state lives outside React so the thread survives
// client navigation, a remount of the shell, and Escape. One module store,
// read with useSyncExternalStore; the panel and the launcher subscribe here.
import { useSyncExternalStore } from "react";
import type { AnalystTurnData } from "@/components/nexus/Workspace";
import type { AskContextItem } from "./context-store";

export type AskPanelState = {
  open: boolean;
  /** the conversation the panel is continuing; null until the first answer */
  conversationId: string | null;
  title: string;
  turns: AnalystTurnData[];
  /** the composer text, kept across routes */
  draft: string;
  /** "kind:id" of the page item the reader removed from the question, so the
   *  same item is not re-attached until the page changes */
  detachedKey: string | null;
  /** bumps whenever something asks the composer to take focus */
  focusTick: number;
};

const INITIAL: AskPanelState = {
  open: false,
  conversationId: null,
  title: "",
  turns: [],
  draft: "",
  detachedKey: null,
  focusTick: 0,
};

/* The thread also survives a full page load (a hard refresh, or the dev
   server forcing one): the store is mirrored into sessionStorage per tab. */
const STORAGE_KEY = "sia:ask-panel";
const STORAGE_CAP = 400_000; // characters; a thread larger than this simply is not mirrored

function restore(): AskPanelState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as Partial<AskPanelState>;
    return {
      ...INITIAL,
      open: Boolean(saved.open),
      conversationId: typeof saved.conversationId === "string" ? saved.conversationId : null,
      title: typeof saved.title === "string" ? saved.title : "",
      turns: Array.isArray(saved.turns) ? saved.turns : [],
      draft: typeof saved.draft === "string" ? saved.draft : "",
      detachedKey: typeof saved.detachedKey === "string" ? saved.detachedKey : null,
    };
  } catch {
    return INITIAL;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const { open, conversationId, title, turns, draft, detachedKey } = state;
      const raw = JSON.stringify({ open, conversationId, title, turns, draft, detachedKey });
      if (raw.length <= STORAGE_CAP) window.sessionStorage.setItem(STORAGE_KEY, raw);
    } catch {
      /* private mode or quota: the in-memory store still carries the thread */
    }
  }, 0);
}

/* The store starts EMPTY on both sides. Reading sessionStorage at module
   load made the first client render differ from the server's snapshot, which
   made React discard the server tree and report every Radix useId below the
   shell as a hydration mismatch (CR08 Phase A). The saved thread is restored
   in an effect after mount instead, by AskEverywhere. */
let state: AskPanelState = INITIAL;
let restored = false;
const listeners = new Set<() => void>();

/** Restores the mirrored thread once, after hydration. */
export function hydrateAskPanel(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  const saved = restore();
  if (saved === INITIAL) return;
  state = saved;
  for (const l of listeners) l();
}

function set(patch: Partial<AskPanelState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
  persist();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function contextKey(item: AskContextItem): string {
  return `${item.kind}:${item.id}`;
}

/** Imperative access for event handlers and callbacks. */
export const askPanel = {
  get: (): AskPanelState => state,
  open(opts?: { focus?: boolean }): void {
    set({ open: true, focusTick: opts?.focus === false ? state.focusTick : state.focusTick + 1 });
  },
  close(): void {
    if (state.open) set({ open: false });
  },
  toggle(opts?: { focus?: boolean }): void {
    if (state.open) askPanel.close();
    else askPanel.open(opts);
  },
  focusComposer(): void {
    set({ focusTick: state.focusTick + 1 });
  },
  setDraft(draft: string): void {
    set({ draft });
  },
  /** the first answer of a fresh thread names the conversation */
  startConversation(id: string, title: string): void {
    if (state.conversationId === id) return;
    set({ conversationId: id, title });
  },
  pushTurn(turn: AnalystTurnData): void {
    set({ turns: [...state.turns, turn] });
  },
  loadConversation(id: string, title: string, turns: AnalystTurnData[]): void {
    set({ conversationId: id, title, turns, draft: "" });
  },
  newConversation(): void {
    set({ conversationId: null, title: "", turns: [], focusTick: state.focusTick + 1 });
  },
  detach(item: AskContextItem): void {
    set({ detachedKey: contextKey(item) });
  },
  reattach(): void {
    set({ detachedKey: null });
  },
};

export function useAskPanelState(): AskPanelState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export function useAskPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.open,
    () => false
  );
}

/** The public hook: open(), close(), toggle() from anywhere in the shell. */
export function useAskPanel(): {
  isOpen: boolean;
  open: (opts?: { focus?: boolean }) => void;
  close: () => void;
  toggle: (opts?: { focus?: boolean }) => void;
} {
  const isOpen = useAskPanelOpen();
  return { isOpen, open: askPanel.open, close: askPanel.close, toggle: askPanel.toggle };
}
