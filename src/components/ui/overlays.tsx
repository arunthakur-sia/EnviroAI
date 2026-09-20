"use client";
// Dialog, dropdown, tabs, tooltip, switch: radix primitives restyled to paper.
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Dialog ---------------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/25 backdrop-blur-[2px] data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed start-1/2 top-1/2 z-50 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2 rounded-2xl border border-sand-300 bg-white p-6 shadow-[var(--shadow-pop)] focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="font-display text-lg text-ink-900">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-md p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-900">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ---------------- Dropdown ---------------- */

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={6}
        className={cn(
          "z-50 min-w-44 rounded-xl border border-sand-300 bg-white p-1.5 shadow-[var(--shadow-pop)]",
          className
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-900 outline-none data-[highlighted]:bg-maroon-100/60 data-[highlighted]:text-maroon-900 [&_svg]:size-4 [&_svg]:text-ink-400",
        className
      )}
      {...props}
    />
  );
}

export const DropdownSeparator = () => (
  <DropdownPrimitive.Separator className="my-1 h-px bg-sand-200" />
);

/* ---------------- Tabs ---------------- */

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        /* CR08 Phase C: a strip of tabs wider than a phone scrolls inside
           itself rather than widening the page. `max-w-full` is what makes
           the inline-flex give way; the triggers keep their size. */
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-sand-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm text-ink-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-maroon-900 data-[state=active]:shadow-sm hover:text-ink-900 cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

/* ---------------- Tooltip ---------------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

export function Tip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-72 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs text-ink-900 shadow-[var(--shadow-paper)]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------------- Switch ---------------- */

export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-5.5 w-10 shrink-0 cursor-pointer rounded-full bg-sand-300 transition-colors data-[state=checked]:bg-maroon-700",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-4.5 w-4.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
