// CR08 7.2: a monogram with the gold, silver or bronze mark of the period's
// top three. Shared by the board, the podium and the Home block.
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type Medal = 1 | 2 | 3;

export function medalOf(rank: number | null | undefined): Medal | null {
  return rank === 1 || rank === 2 || rank === 3 ? rank : null;
}

/* tokens only: gold for first, ink-400 reads as silver, warn as bronze */
export const MEDAL_RING: Record<Medal, string> = {
  1: "ring-aqua-500",
  2: "ring-ink-400",
  3: "ring-warn",
};
/* Each ground carries the ink that reads on it: white on gold measures 2.4 to 1
   and white on the silver grey 2.8, so those two take dark numerals instead. */
export const MEDAL_BG: Record<Medal, string> = {
  1: "bg-aqua-500 text-ink-900",
  2: "bg-ink-400 text-ink-900",
  3: "bg-warn text-white",
};

export function MedalAvatar({
  name,
  color,
  size = 32,
  rank,
  className,
  label,
}: {
  name: string;
  color?: string;
  size?: number;
  rank: number | null | undefined;
  className?: string;
  /** an accessible name for the medal, e.g. "Gold" */
  label?: string;
}) {
  const medal = medalOf(rank);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        medal && "ring-[3px] ring-offset-2 ring-offset-white",
        medal && MEDAL_RING[medal],
        className
      )}
      data-medal={medal ?? undefined}
    >
      <Avatar name={name} color={color} size={size} />
      {medal ? (
        <span
          className={cn(
            "absolute -bottom-1 -end-1 flex size-4.5 items-center justify-center rounded-full text-[9px] font-bold leading-none ring-2 ring-white tnum",
            MEDAL_BG[medal]
          )}
          role={label ? "img" : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
        >
          {medal}
        </span>
      ) : null}
    </span>
  );
}
