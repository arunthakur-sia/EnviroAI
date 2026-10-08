"use client";
// CR08 2.3: mount on any item page (project, document, indicator, council
// node, unit, index, lesson, process, report) to tell the Ask EnviroAI launcher
// what the reader is looking at. Renders nothing.
import * as React from "react";
import { clearAskContext, setAskContext, type AskContextItem as Item } from "./context-store";

export function AskContextItem({ item }: { item: Item }) {
  const key = `${item.kind}:${item.id}`;
  React.useEffect(() => {
    setAskContext(item);
    return () => clearAskContext(item);
    // the item identity is the kind + id; titles do not re-register
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
