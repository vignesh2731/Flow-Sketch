"use client";

import { memo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
  type XYPosition,
} from "@xyflow/react";
import { useEditor } from "./context";
import { InlineEditor } from "./nodes";
import type { FlowEdge, FlowNode } from "./types";

const STEP = { borderRadius: 12, offset: 24 };

/** The side of `point` that faces `from`, used to enter/leave a bend point. */
function sideFacing(from: XYPosition, point: XYPosition): Position {
  const dx = from.x - point.x;
  const dy = from.y - point.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? Position.Right : Position.Left;
  return dy > 0 ? Position.Bottom : Position.Top;
}

/** Pixels the pointer must travel before a press on the handle counts as a drag. */
const DRAG_THRESHOLD = 3;

function FlowEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<FlowEdge>) {
  const { editingEdgeId, setEditingEdgeId, takeSnapshot } = useEditor();
  const { updateEdgeData, screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>();
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const via = data?.via;

  let path: string;
  let center: XYPosition;
  if (via) {
    // Route source -> bend point -> target as two right-angled segments.
    const [first] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX: via.x,
      targetY: via.y,
      targetPosition: sideFacing(source, via),
      ...STEP,
    });
    const [second] = getSmoothStepPath({
      sourceX: via.x,
      sourceY: via.y,
      sourcePosition: sideFacing(target, via),
      targetX,
      targetY,
      targetPosition,
      ...STEP,
    });
    path = `${first} ${second}`;
    center = via;
  } else {
    const [full, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      ...STEP,
    });
    path = full;
    center = { x: labelX, y: labelY };
  }

  const editing = editingEdgeId === id;
  const label = data?.label ?? "";

  // Dragging the label (or the dot on a selected, unlabeled connector) moves the bend.
  const startBendDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const handle = e.currentTarget;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    handle.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
        dragging = true;
        takeSnapshot();
      }
      const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      updateEdgeData(id, { via: { x: Math.round(p.x / 5) * 5, y: Math.round(p.y / 5) * 5 } });
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  let handle: ReactNode = null;
  if (editing) {
    handle = (
      <div className="w-40 rounded-md bg-white text-xs shadow-md dark:bg-zinc-900">
        <InlineEditor
          initial={label}
          className="text-center"
          onDone={(next) => {
            setEditingEdgeId(null);
            if (next === null || next.trim() === label) return;
            takeSnapshot();
            updateEdgeData(id, { label: next.trim() });
          }}
        />
      </div>
    );
  } else if (label) {
    handle = (
      <div
        onPointerDown={startBendDrag}
        onDoubleClick={() => setEditingEdgeId(id)}
        title="Drag to bend the connector, double-click to edit"
        className={`cursor-move rounded-md border bg-white px-2 py-0.5 text-xs font-medium whitespace-pre text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200 ${
          selected ? "border-sky-500" : "border-zinc-200 dark:border-zinc-700"
        }`}
      >
        {label}
      </div>
    );
  } else if (selected) {
    handle = (
      <div
        onPointerDown={startBendDrag}
        onDoubleClick={() => setEditingEdgeId(id)}
        title="Drag to bend the connector, double-click to add a label"
        className="h-3.5 w-3.5 cursor-move rounded-full border-2 border-sky-500 bg-white shadow-sm"
      />
    );
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={22}
        style={{
          stroke: selected ? "var(--flow-accent)" : "var(--flow-edge)",
          strokeWidth: selected ? 2.25 : 1.75,
          strokeDasharray: data?.dashed ? "6 5" : undefined,
        }}
      />
      {handle && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${center.x}px, ${center.y}px)`,
              pointerEvents: "all",
            }}
          >
            {handle}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { flow: memo(FlowEdgeView) };
