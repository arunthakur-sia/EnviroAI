"use client";
// CR03 4: the connected canvas. Provides the useConnections pub-sub, draws
// the constellation behind the bento content, and fades it in last in the
// entrance choreography.
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ConnectionsProvider } from "./connections";
import { Constellation, type ConstellationData } from "./Constellation";

export function HomeBoard({
  constellation,
  children,
}: {
  constellation: ConstellationData;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <ConnectionsProvider>
      <div className="relative mx-auto max-w-[1240px]">
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          aria-hidden
        >
          <Constellation data={constellation} />
        </motion.div>
        <div className="relative">{children}</div>
      </div>
    </ConnectionsProvider>
  );
}
