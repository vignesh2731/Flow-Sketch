"use client";

import { useCallback, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { FlowEdge, FlowNode } from "./types";

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

const MAX_HISTORY = 100;

/**
 * Snapshot-based undo/redo. Call `takeSnapshot()` right before a change you
 * want to be undoable (drag start, connect, delete, text edit, ...).
 */
export function useHistory() {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow<
    FlowNode,
    FlowEdge
  >();
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [counts, setCounts] = useState({ past: 0, future: 0 });

  const sync = useCallback(
    () =>
      setCounts({ past: past.current.length, future: future.current.length }),
    [],
  );

  const current = useCallback(
    (): Snapshot => ({ nodes: getNodes(), edges: getEdges() }),
    [getNodes, getEdges],
  );

  const takeSnapshot = useCallback(() => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), current()];
    future.current = [];
    sync();
  }, [current, sync]);

  const restore = useCallback(
    (from: { current: Snapshot[] }, to: { current: Snapshot[] }) => {
      const snapshot = from.current.at(-1);
      if (!snapshot) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, current()];
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      sync();
    },
    [current, setNodes, setEdges, sync],
  );

  const undo = useCallback(() => restore(past, future), [restore]);
  const redo = useCallback(() => restore(future, past), [restore]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: counts.past > 0,
    canRedo: counts.future > 0,
  };
}
