"use client";
// CR03 4 recomposed the Today row into the bento cards (QatarNumbers.tsx,
// DailyChallenge.tsx, PodcastCard.tsx, ChangedTimeline.tsx). Only the podcast
// waveform glyph still lives here because the podcast pages import it from
// this path; file deletion is blocked in this environment.
import { cn } from "@/lib/utils";

/* The podcast mark: a simple maroon waveform glyph drawn as SVG (CR02 1.4).
   CR03 4.4.5: give it the wave-playing class to make the bars dance. */
export function WaveformMark({ className }: { className?: string }) {
  const bars = [7, 13, 19, 11, 16, 8, 14, 6];
  return (
    <svg
      viewBox="0 0 46 24"
      className={cn("text-maroon-700", className)}
      aria-hidden
      fill="currentColor"
    >
      {bars.map((h, i) => (
        <rect key={i} x={i * 6} y={12 - h / 2} width="3.2" height={h} rx="1.6" />
      ))}
    </svg>
  );
}
