"use client";
// CR08 8: the read marker. Ten points, once, to a colleague who reads this
// week's pick in full, however they arrived at it: the Home strip, the
// reveal, a shelf, a search result or a shared link. It has no UI of its
// own. "In full" is read as either a minute of attention with the tab in
// front (time spent hidden does not count) or reaching the end of the page,
// whichever comes first. The server counts the read once per person per
// pick, so a second visit costs nothing.
import * as React from "react";
import { kowPatch } from "./client";

type ActiveCard = { id: string; resourceType: string; resourceId: string; viewerRead: boolean } | null;

const TICK_MS = 1000;
const DEFAULT_SECONDS = 60;

export function KowReadMarker({
  resourceType,
  resourceId,
  seconds = DEFAULT_SECONDS,
}: {
  /** "document" for a study too: the pick stores the type it was set with */
  resourceType: string;
  resourceId: string;
  /** Attention, in seconds, that counts as a full read */
  seconds?: number;
}) {
  React.useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let done = false;
    let attention = 0;

    const finish = (kowId: string) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      void kowPatch("read", kowId);
    };

    let pickId = "";
    function onScroll() {
      if (!pickId || done) return;
      const doc = document.documentElement;
      const reached = window.scrollY + window.innerHeight >= doc.scrollHeight - 120;
      if (reached) finish(pickId);
    }

    fetch("/api/v1/knowledge-of-week?view=active")
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((json: { data: ActiveCard }) => {
        const card = json.data;
        if (cancelled || !card || card.viewerRead) return;
        const sameItem =
          card.resourceId === resourceId &&
          (card.resourceType === resourceType ||
            // a study is a document: either spelling points at the same row
            (["document", "study"].includes(card.resourceType) && ["document", "study"].includes(resourceType)));
        if (!sameItem) return;
        pickId = card.id;
        timer = window.setInterval(() => {
          if (document.visibilityState !== "visible") return;
          attention += TICK_MS / 1000;
          if (attention >= seconds) finish(card.id);
        }, TICK_MS);
        window.addEventListener("scroll", onScroll, { passive: true });
      })
      .catch(() => {
        /* the pick is not the reader's concern if it cannot be loaded */
      });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [resourceType, resourceId, seconds]);

  return null;
}
