"use client";
// CR02 2.2/3.2: the Deliverables | Lessons | Documents tab strip on node
// detail pages. Server-rendered content arrives through the slot props.
import * as React from "react";
import { cn } from "@/lib/utils";

export function NodeTabs({
  tabs,
}: {
  tabs: { key: string; label: string; badge?: number; content: React.ReactNode }[];
}) {
  const [active, setActive] = React.useState(tabs[0]?.key ?? "");
  return (
    <div data-testid="node-tabs">
      <div role="tablist" className="mb-4 flex items-center gap-1 border-b border-sand-300">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors cursor-pointer",
              active === tab.key
                ? "border-maroon-700 font-medium text-maroon-900"
                : "border-transparent text-ink-600 hover:text-ink-900"
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 tnum">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={active !== tab.key}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
