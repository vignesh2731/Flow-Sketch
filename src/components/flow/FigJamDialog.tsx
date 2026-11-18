"use client";

import { useEffect, useState } from "react";

export default function FigJamDialog({
  code,
  filename,
  onClose,
}: {
  code: string;
  filename: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  const downloadFile = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.mmd`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="figjam-dialog-title"
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--flow-border)] bg-[var(--flow-panel)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="figjam-dialog-title" className="text-base font-semibold">
              Copy for FigJam
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pastes into FigJam as editable shapes and connectors.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>Copy the text below (or download it) and send it over.</li>
          <li>
            In FigJam, open <b>Resources → Plugins</b> and run a Mermaid plugin
            such as <b>Mermaid to FigJam</b>.
          </li>
          <li>Paste the text into the plugin and generate.</li>
        </ol>

        <textarea
          readOnly
          value={code}
          rows={12}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-y rounded-lg border border-[var(--flow-border)] bg-zinc-50 p-3 font-mono text-xs text-zinc-800 outline-none focus:border-sky-500 dark:bg-zinc-950 dark:text-zinc-200"
        />

        <p className="text-xs text-zinc-500">
          FigJam lays the flow out automatically, so positions and colors won’t
          match exactly. Screen descriptions aren’t included; notes come in as
          plain boxes.
        </p>

        <div className="flex items-center justify-end gap-2">
          {copied === "failed" && (
            <span className="mr-auto text-xs text-rose-500">
              Couldn’t access the clipboard. Select the text and press Ctrl+C.
            </span>
          )}
          <button
            type="button"
            onClick={downloadFile}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download .mmd
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            {copied === "done" ? "Copied ✓" : "Copy text"}
          </button>
        </div>
      </div>
    </div>
  );
}
