"use client";

import { useRef, type ReactNode } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor } from "./context";
import { COLORS, KINDS, type FlowEdge, type FlowNode } from "./types";

const inputClass =
  "w-full rounded-md border border-[var(--flow-border)] bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-sky-500 dark:bg-zinc-900 dark:text-zinc-100";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Snapshot once per focus session so typing a word is a single undo step. */
function useEditSession() {
  const { takeSnapshot } = useEditor();
  const active = useRef(false);
  return {
    touch: () => {
      if (active.current) return;
      takeSnapshot();
      active.current = true;
    },
    end: () => {
      active.current = false;
    },
  };
}

function NodeInspector({ node }: { node: FlowNode }) {
  const { updateNodeData } = useReactFlow<FlowNode, FlowEdge>();
  const { takeSnapshot } = useEditor();
  const session = useEditSession();
  const hasDescription = node.type === "screen";

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {KINDS[node.type ?? "action"].name}
      </p>
      <Field label="Label">
        <textarea
          rows={node.type === "note" ? 4 : 2}
          className={`${inputClass} resize-none`}
          value={node.data.label}
          onChange={(e) => {
            session.touch();
            updateNodeData(node.id, { label: e.target.value });
          }}
          onBlur={session.end}
        />
      </Field>
      {hasDescription && (
        <Field label="Description">
          <textarea
            rows={4}
            className={`${inputClass} resize-none`}
            value={node.data.description ?? ""}
            onChange={(e) => {
              session.touch();
              updateNodeData(node.id, { description: e.target.value });
            }}
            onBlur={session.end}
          />
        </Field>
      )}
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => {
                if (color === node.data.color) return;
                takeSnapshot();
                updateNodeData(node.id, { color });
              }}
              className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-[var(--flow-panel)] ${
                color === node.data.color ? "ring-2 ring-sky-500" : ""
              }`}
              style={{ background: color }}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}

function EdgeInspector({ edge }: { edge: FlowEdge }) {
  const { updateEdgeData, updateEdge } = useReactFlow<FlowNode, FlowEdge>();
  const { takeSnapshot } = useEditor();
  const session = useEditSession();

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        Connector
      </p>
      <Field label="Label">
        <input
          className={inputClass}
          placeholder="e.g. Yes, Submit, Error"
          value={edge.data?.label ?? ""}
          onChange={(e) => {
            session.touch();
            updateEdgeData(edge.id, { label: e.target.value });
          }}
          onBlur={session.end}
        />
      </Field>
      <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!edge.data?.dashed}
            onChange={(e) => {
              takeSnapshot();
              updateEdgeData(edge.id, { dashed: e.target.checked });
            }}
          />
          Dashed (alternate / error path)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!edge.animated}
            onChange={(e) => {
              takeSnapshot();
              updateEdge(edge.id, { animated: e.target.checked });
            }}
          />
          Animated
        </label>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-zinc-500">
          Drag the connector’s label or middle dot to bend it around other
          shapes. Drag an end onto another dot to reconnect it.
        </p>
        {edge.data?.via && (
          <button
            type="button"
            onClick={() => {
              takeSnapshot();
              updateEdgeData(edge.id, { via: undefined });
            }}
            className="rounded-md border border-[var(--flow-border)] px-2.5 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reset bend
          </button>
        )}
      </div>
    </div>
  );
}

const TIPS: [string, string][] = [
  ["Add", "Drag a shape from the left, or click it"],
  ["Connect", "Drag from a node's edge dot to another node"],
  ["Bend arrow", "Drag its label, or select it and drag the middle dot"],
  ["Reroute arrow", "Drag either end onto another dot"],
  ["Edit text", "Double-click any text or connector"],
  ["New line", "Enter. Click away or Ctrl+Enter to finish"],
  ["Select", "Drag on empty canvas, Shift+click to add"],
  ["Pan", "Scroll, or hold Space and drag"],
  ["Zoom", "Ctrl + scroll, or pinch"],
  ["Undo / Redo", "Ctrl+Z / Ctrl+Shift+Z"],
  ["Duplicate", "Ctrl+D (or Ctrl+C, Ctrl+V)"],
  ["Delete", "Delete or Backspace"],
];

export default function Inspector({
  nodes,
  edges,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
}) {
  let body: ReactNode;
  if (nodes.length === 1 && edges.length === 0) {
    body = <NodeInspector key={nodes[0].id} node={nodes[0]} />;
  } else if (edges.length === 1 && nodes.length === 0) {
    body = <EdgeInspector key={edges[0].id} edge={edges[0]} />;
  } else if (nodes.length + edges.length > 1) {
    body = (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {nodes.length} nodes and {edges.length} connectors selected.
      </p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Quick guide
        </p>
        <dl className="space-y-2.5">
          {TIPS.map(([term, detail]) => (
            <div key={term}>
              <dt className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                {term}
              </dt>
              <dd className="text-xs text-zinc-500">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-[var(--flow-border)] bg-[var(--flow-panel)] p-4">
      {body}
    </aside>
  );
}
