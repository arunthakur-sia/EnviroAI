"use client";
// Dropping a file anywhere in the app opens the Vault upload flow with the file.
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { UploadCloud } from "lucide-react";

// Module-level handoff store: files dropped anywhere are picked up by /vault/upload.
let pendingFiles: File[] = [];
export function takePendingFiles(): File[] {
  const f = pendingFiles;
  pendingFiles = [];
  return f;
}

export function GlobalDropZone({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const router = useRouter();
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth.current++;
      setDragging(true);
    };
    const onDragLeave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth.current = 0;
      setDragging(false);
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      pendingFiles = Array.from(e.dataTransfer.files);
      router.push("/vault/upload");
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [enabled, router]);

  return (
    <>
      {children}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/20 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white bg-white/95 px-12 py-10 shadow-[var(--shadow-pop)]">
            <UploadCloud className="size-10 text-navy-700" />
            <p className="text-lg font-medium text-ink-900">{t("dropToUpload")}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
