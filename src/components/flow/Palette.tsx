"use client";

import { kindPreview } from "./nodes";
import { KINDS, type NodeKind } from "./types";

export const DRAG_MIME = "application/x-flow-kind";

export default function Palette({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  return (
    <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-[var(--flow-border)] bg-[var(--flow-panel)] p-3">
      <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Shapes
      </h2>
      {(Object.keys(KINDS) as NodeKind[]).map((kind) => (
        <button
          key={kind}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, kind);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onAdd(kind)}
          title="Drag onto the canvas, or click to add"
          className="flex cursor-grab items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
        >
          <span className="flex h-8 w-10 shrink-0 items-center justify-center">
            {kindPreview[kind]}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {KINDS[kind].name}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {KINDS[kind].hint}
            </span>
          </span>
        </button>
      ))}
    </aside>
  );
}
