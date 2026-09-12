"use client";
// CR03 4.2: the small pub-sub every Home card registers into. Hovering a card
// publishes its outcome (taxonomy code) or topic; the constellation, the
// progress dots, and the What changed rows subscribe.
import * as React from "react";

type ConnectionsState = {
  hovered: string | null; // outcome taxonomy code
  setHovered: (outcome: string | null) => void;
  askFocused: boolean;
  setAskFocused: (v: boolean) => void;
};

const ConnectionsContext = React.createContext<ConnectionsState | null>(null);

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [askFocused, setAskFocused] = React.useState(false);
  const value = React.useMemo(
    () => ({ hovered, setHovered, askFocused, setAskFocused }),
    [hovered, askFocused]
  );
  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections(): ConnectionsState | null {
  return React.useContext(ConnectionsContext);
}

/** Registers a region: hovering it lights the constellation for its outcome. */
export function Connected({
  outcome,
  children,
  className,
}: {
  outcome: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const conn = useConnections();
  return (
    <div
      className={className}
      onMouseEnter={() => outcome && conn?.setHovered(outcome)}
      onMouseLeave={() => conn?.setHovered(null)}
    >
      {children}
    </div>
  );
}
