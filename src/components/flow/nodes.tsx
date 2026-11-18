"use client";

import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
} from "@xyflow/react";
import { useEditor } from "./context";
import type { FlowEdge, FlowNode, FlowNodeData } from "./types";

/**
 * Inline text editor. Single-line: Enter commits. Multiline: Enter adds a new
 * line and Ctrl/Cmd+Enter commits. Clicking away commits; Escape cancels.
 */
export function InlineEditor({
  initial,
  multiline,
  width,
  className = "",
  onDone,
}: {
  initial: string;
  multiline?: boolean;
  /** Width of the text being edited, so it wraps exactly as it did on screen. */
  width?: number;
  className?: string;
  onDone: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const finished = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit all the text, including lines that wrap.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const finish = (value: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };

  return (
    <textarea
      ref={ref}
      autoFocus
      rows={1}
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(draft)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish(null);
        if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          finish(draft);
        }
      }}
      // +8 makes room for the px-1 padding so the text area matches the text.
      style={width ? { width: Math.max(width, 60) + 8, maxWidth: "100%" } : undefined}
      className={`nodrag nowheel nopan w-full resize-none overflow-hidden rounded bg-white/90 px-1 text-inherit [text-align:inherit] outline-2 outline-sky-500 dark:bg-zinc-900/90 ${className}`}
    />
  );
}

function EditableText({
  nodeId,
  field,
  value,
  placeholder,
  className = "",
}: {
  nodeId: string;
  field: "label" | "description";
  value: string;
  placeholder: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [textWidth, setTextWidth] = useState<number>();
  const { updateNodeData } = useReactFlow<FlowNode, FlowEdge>();
  const { takeSnapshot } = useEditor();

  if (editing) {
    return (
      <InlineEditor
        initial={value}
        multiline
        width={textWidth}
        className={className}
        onDone={(next) => {
          setEditing(false);
          if (next === null || next === value) return;
          takeSnapshot();
          updateNodeData(nodeId, { [field]: next } as Partial<FlowNodeData>);
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        // offsetWidth is the unzoomed layout width, which is what the editor needs.
        setTextWidth(e.currentTarget.offsetWidth);
        setEditing(true);
      }}
      className={`cursor-text whitespace-pre-wrap break-words ${className}`}
    >
      {value || <span className="opacity-40">{placeholder}</span>}
    </div>
  );
}

/**
 * True once the node has been resized (it carries an explicit width).
 * NodeProps' `width` is the *measured* width, so it can't tell us this.
 */
function useResized(id: string) {
  return useStore((s) => s.nodeLookup.get(id)?.width != null);
}

function Handles() {
  return (
    <>
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map(
        (position) => (
          <Handle
            key={position}
            id={position}
            type="source"
            position={position}
            className="flow-handle"
          />
        ),
      )}
    </>
  );
}

function Resizer({
  selected,
  minWidth,
  minHeight,
}: {
  selected: boolean;
  minWidth: number;
  minHeight: number;
}) {
  const { takeSnapshot } = useEditor();
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      onResizeStart={takeSnapshot}
      lineClassName="!border-sky-500"
      handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-sky-500 !bg-white"
    />
  );
}

function TerminalNode({ id, data, selected }: NodeProps<FlowNode>) {
  // Sizes to its text until resized, then fills the size you picked.
  const sizing = useResized(id) ? "h-full w-full" : "min-w-[120px] max-w-[220px]";
  return (
    <>
      <Resizer selected={selected} minWidth={80} minHeight={32} />
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm ${sizing}`}
        style={{ background: data.color }}
      >
        <EditableText nodeId={id} field="label" value={data.label} placeholder="Start" />
      </div>
      <Handles />
    </>
  );
}

function ScreenNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <>
      <Resizer selected={selected} minWidth={150} minHeight={120} />
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm dark:bg-zinc-900"
        style={{ borderColor: data.color }}
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ background: `${data.color}1a`, borderColor: `${data.color}40` }}
        >
          <span className="flex shrink-0 gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: `${data.color}99` }}
              />
            ))}
          </span>
          <EditableText
            nodeId={id}
            field="label"
            value={data.label}
            placeholder="Screen name"
            className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <EditableText
            nodeId={id}
            field="description"
            value={data.description ?? ""}
            placeholder="Double-click to describe this screen"
            className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
          />
        </div>
      </div>
      <Handles />
    </>
  );
}

function ActionNode({ id, data, selected }: NodeProps<FlowNode>) {
  // Sizes to its text until resized, then fills the size you picked.
  const sizing = useResized(id) ? "h-full w-full" : "min-w-[150px] max-w-[240px]";
  return (
    <>
      <Resizer selected={selected} minWidth={80} minHeight={40} />
      <div
        className={`flex items-center justify-center overflow-hidden rounded-lg border-2 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100 ${sizing}`}
        style={{ borderColor: data.color }}
      >
        <EditableText nodeId={id} field="label" value={data.label} placeholder="Action" />
      </div>
      <Handles />
    </>
  );
}

function DecisionNode({ id, data, selected }: NodeProps<FlowNode>) {
  const resized = useResized(id);
  return (
    <>
      <Resizer selected={selected} minWidth={80} minHeight={60} />
      <div className={`relative ${resized ? "h-full w-full" : "h-[140px] w-[140px]"}`}>
        <svg
          className="absolute inset-0 h-full w-full overflow-visible drop-shadow-sm"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            points="50,1 99,50 50,99 1,50"
            // Opaque tint (mixed into the panel color) so the canvas doesn't show through.
            style={{ fill: `color-mix(in srgb, ${data.color} 28%, var(--flow-panel))` }}
            stroke={selected ? "#0ea5e9" : data.color}
            strokeWidth={selected ? 3 : 2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Text sits in the square inscribed in the diamond, so it scales with it. */}
        <div className="absolute inset-[22%] flex items-center justify-center text-center text-xs font-semibold text-zinc-800 dark:text-zinc-100">
          <EditableText nodeId={id} field="label" value={data.label} placeholder="Condition?" />
        </div>
        <Handles />
      </div>
    </>
  );
}

function NoteNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <>
      <Resizer selected={selected} minWidth={120} minHeight={70} />
      <div
        className="h-full w-full overflow-hidden rounded-sm p-3 text-sm text-zinc-800 shadow-md dark:text-zinc-900"
        style={{ background: `color-mix(in srgb, ${data.color} 30%, #fffbea)` }}
      >
        <EditableText
          nodeId={id}
          field="label"
          value={data.label}
          placeholder="Write a note"
        />
      </div>
    </>
  );
}

function SectionNode({ id, data, selected }: NodeProps<FlowNode>) {
  return (
    <>
      <Resizer selected={selected} minWidth={200} minHeight={140} />
      <div
        className="h-full w-full rounded-2xl border-2 border-dashed"
        style={{ borderColor: `${data.color}80`, background: `${data.color}0d` }}
      >
        <div
          className="inline-block max-w-full rounded-br-xl rounded-tl-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ background: data.color }}
        >
          <EditableText nodeId={id} field="label" value={data.label} placeholder="Stage" />
        </div>
      </div>
    </>
  );
}

export const nodeTypes = {
  terminal: memo(TerminalNode),
  screen: memo(ScreenNode),
  action: memo(ActionNode),
  decision: memo(DecisionNode),
  note: memo(NoteNode),
  section: memo(SectionNode),
};

/** Small static previews used in the shape palette. */
export const kindPreview: Record<FlowNode["type"] & string, ReactNode> = {
  terminal: <span className="h-4 w-9 rounded-full bg-emerald-500" />,
  screen: (
    <span className="flex h-7 w-6 flex-col overflow-hidden rounded border-2 border-blue-500">
      <span className="h-1.5 bg-blue-500/30" />
    </span>
  ),
  action: <span className="h-5 w-9 rounded border-2 border-slate-500" />,
  decision: <span className="h-5 w-5 rotate-45 border-2 border-amber-500 bg-amber-500/15" />,
  note: <span className="h-6 w-7 bg-amber-200 shadow-sm" />,
  section: (
    <span className="h-6 w-9 rounded border-2 border-dashed border-violet-500 bg-violet-500/10" />
  ),
};
