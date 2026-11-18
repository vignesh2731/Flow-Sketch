"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  reconnectEdge,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnBeforeDelete,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { EditorContext } from "./context";
import { edgeTypes } from "./edges";
import FigJamDialog from "./FigJamDialog";
import Inspector from "./Inspector";
import { nodeTypes } from "./nodes";
import Palette, { DRAG_MIME } from "./Palette";
import { toMermaid } from "./mermaid";
import { loadDoc, parseDoc, sampleDoc, saveDoc } from "./storage";
import {
  ARROW,
  KINDS,
  createNode,
  isInside,
  uid,
  type FlowEdge,
  type FlowNode,
  type NodeKind,
} from "./types";
import { useHistory } from "./useHistory";

type Clipboard = { nodes: FlowNode[]; edges: FlowEdge[] };

/** Tracks a section being dragged so the nodes inside it move along. */
type SectionDrag = {
  sectionId: string;
  start: XYPosition;
  children: Map<string, XYPosition>;
};

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

const slug = (title: string) =>
  title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
  "flow";

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-md px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function Editor() {
  const [initial] = useState(() => loadDoc() ?? sampleDoc());
  const [title, setTitle] = useState(initial.title);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initial.edges);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [figjamCode, setFigjamCode] = useState<string | null>(null);
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory();

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Clipboard | null>(null);
  const sectionDrag = useRef<SectionDrag | null>(null);

  // Autosave to this browser.
  useEffect(() => {
    const t = setTimeout(() => saveDoc({ title, nodes, edges }), 300);
    return () => clearTimeout(t);
  }, [title, nodes, edges]);

  const context = useMemo(
    () => ({ takeSnapshot, editingEdgeId, setEditingEdgeId }),
    [takeSnapshot, editingEdgeId],
  );

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);

  // ---- Adding & connecting ------------------------------------------------

  const addNodeAt = useCallback(
    (kind: NodeKind, center: XYPosition) => {
      takeSnapshot();
      const node = createNode(kind, center);
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
      setEdges((es) => es.map((e) => ({ ...e, selected: false })));
    },
    [takeSnapshot, setNodes, setEdges],
  );

  const addNodeAtCenter = useCallback(
    (kind: NodeKind) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Nudge each new node a little so repeated clicks don't stack exactly.
      const jitter = (Math.random() - 0.5) * 60;
      const center = rf.screenToFlowPosition({
        x: rect.left + rect.width / 2 + jitter,
        y: rect.top + rect.height / 2 + jitter,
      });
      addNodeAt(kind, center);
    },
    [rf, addNodeAt],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind;
      if (!(kind in KINDS)) return;
      e.preventDefault();
      addNodeAt(kind, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [rf, addNodeAt],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;
      takeSnapshot();
      setEdges((es) =>
        addEdge<FlowEdge>(
          { ...connection, id: uid("e"), type: "flow", markerEnd: ARROW, data: {} },
          es,
        ),
      );
    },
    [takeSnapshot, setEdges],
  );

  // Drag either end of a connector onto another dot to reroute it.
  const onReconnect = useCallback(
    (oldEdge: FlowEdge, connection: Connection) => {
      if (connection.source === connection.target) return;
      takeSnapshot();
      setEdges((es) =>
        reconnectEdge(oldEdge, connection, es, { shouldReplaceId: false }),
      );
    },
    [takeSnapshot, setEdges],
  );

  const onBeforeDelete: OnBeforeDelete<FlowNode, FlowEdge> = useCallback(
    async () => {
      takeSnapshot();
      return true;
    },
    [takeSnapshot],
  );

  // ---- Dragging sections with their contents ------------------------------

  const onNodeDragStart = useCallback(
    (_: unknown, node: FlowNode) => {
      takeSnapshot();
      if (node.type !== "section") return;
      const children = new Map<string, XYPosition>();
      for (const n of rf.getNodes()) {
        if (n.id !== node.id && n.type !== "section" && !n.selected && isInside(n, node)) {
          children.set(n.id, n.position);
        }
      }
      sectionDrag.current = { sectionId: node.id, start: node.position, children };
    },
    [rf, takeSnapshot],
  );

  const onNodeDrag = useCallback(
    (_: unknown, node: FlowNode) => {
      const drag = sectionDrag.current;
      if (!drag || drag.sectionId !== node.id || drag.children.size === 0) return;
      const dx = node.position.x - drag.start.x;
      const dy = node.position.y - drag.start.y;
      setNodes((ns) =>
        ns.map((n) => {
          const from = drag.children.get(n.id);
          return from ? { ...n, position: { x: from.x + dx, y: from.y + dy } } : n;
        }),
      );
    },
    [setNodes],
  );

  const onNodeDragStop = useCallback(() => {
    sectionDrag.current = null;
  }, []);

  // ---- Clipboard ----------------------------------------------------------

  const copySelection = useCallback(() => {
    const picked = rf.getNodes().filter((n) => n.selected);
    if (!picked.length) return false;
    const ids = new Set(picked.map((n) => n.id));
    clipboard.current = {
      nodes: picked,
      edges: rf.getEdges().filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
    return true;
  }, [rf]);

  const paste = useCallback(() => {
    const clip = clipboard.current;
    if (!clip) return;
    takeSnapshot();
    const idMap = new Map<string, string>();
    const pastedNodes: FlowNode[] = clip.nodes.map((n) => {
      const id = uid("n");
      idMap.set(n.id, id);
      return {
        ...n,
        id,
        selected: true,
        dragging: false,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: { ...n.data },
      };
    });
    const pastedEdges: FlowEdge[] = clip.edges.map((e) => ({
      ...e,
      id: uid("e"),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
      data: {
        ...e.data,
        via: e.data?.via && { x: e.data.via.x + 40, y: e.data.via.y + 40 },
      },
    }));
    // Pasting again offsets from the last paste, like Figma.
    clipboard.current = { nodes: pastedNodes, edges: pastedEdges };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...pastedNodes]);
    setEdges((es) => [...es.map((e) => ({ ...e, selected: false })), ...pastedEdges]);
  }, [takeSnapshot, setNodes, setEdges]);

  const duplicate = useCallback(() => {
    if (copySelection()) paste();
  }, [copySelection, paste]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "d") {
        e.preventDefault();
        duplicate();
      } else if (key === "c") {
        copySelection();
      } else if (key === "v") {
        e.preventDefault();
        paste();
      } else if (key === "s") {
        e.preventDefault(); // Already autosaved; stop the browser's save dialog.
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, duplicate, copySelection, paste]);

  // ---- File actions -------------------------------------------------------

  const exportPng = useCallback(async () => {
    const all = rf.getNodes();
    const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!all.length || !viewportEl) return;
    const padding = 48;
    const bounds = getNodesBounds(all);
    const width = Math.ceil(bounds.width + padding * 2);
    const height = Math.ceil(bounds.height + padding * 2);
    const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, 0);
    const background = getComputedStyle(
      viewportEl.closest(".react-flow") ?? viewportEl,
    ).backgroundColor;
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: background,
      width,
      height,
      pixelRatio: 2,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    download(dataUrl, `${slug(title)}.png`);
  }, [rf, title]);

  const exportJson = useCallback(() => {
    const clean = <T extends { selected?: boolean }>(items: T[]) =>
      items.map((item) => ({ ...item, selected: false }));
    const blob = new Blob(
      [JSON.stringify({ title, nodes: clean(rf.getNodes()), edges: clean(rf.getEdges()) }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    download(url, `${slug(title)}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [rf, title]);

  const importJson = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      let doc = null;
      try {
        doc = parseDoc(await file.text());
      } catch {
        // Falls through to the error below.
      }
      if (!doc) {
        alert("That file isn't a Flow Sketch JSON export.");
        return;
      }
      takeSnapshot();
      setTitle(doc.title);
      setNodes(doc.nodes);
      setEdges(doc.edges);
      setTimeout(() => rf.fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [rf, takeSnapshot, setNodes, setEdges],
  );

  const clearCanvas = useCallback(() => {
    if (!confirm("Clear everything on the canvas? You can undo this.")) return;
    takeSnapshot();
    setNodes([]);
    setEdges([]);
  }, [takeSnapshot, setNodes, setEdges]);

  return (
    <EditorContext.Provider value={context}>
      <div className="flex h-full w-full flex-col bg-[var(--flow-canvas)] text-zinc-900 dark:text-zinc-100">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--flow-border)] bg-[var(--flow-panel)] px-3">
          <span className="mr-2 flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-sky-500 text-xs text-white">
              ◇
            </span>
            Flow Sketch
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Flow title"
            className="w-56 rounded-md bg-transparent px-2 py-1 text-sm hover:bg-zinc-100 focus:bg-white focus:outline-2 focus:outline-sky-500 dark:hover:bg-zinc-800 dark:focus:bg-zinc-900"
          />
          <div className="ml-2 flex items-center">
            <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              ↶ Undo
            </ToolbarButton>
            <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              ↷ Redo
            </ToolbarButton>
          </div>
          <div className="ml-auto flex items-center">
            <span className="mr-3 hidden text-xs text-zinc-500 lg:inline">
              Autosaved in this browser
            </span>
            <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Open a .json flow">
              Import
            </ToolbarButton>
            <ToolbarButton onClick={exportJson} title="Download as .json">
              Export JSON
            </ToolbarButton>
            <ToolbarButton onClick={clearCanvas} title="Remove everything">
              Clear
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setFigjamCode(toMermaid(rf.getNodes(), rf.getEdges()))}
              title="Get text that pastes into FigJam as editable shapes"
            >
              Copy for FigJam
            </ToolbarButton>
            <button
              type="button"
              onClick={exportPng}
              className="ml-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Export PNG
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={importJson}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <Palette onAdd={addNodeAtCenter} />
          <div ref={canvasRef} className="relative min-w-0 flex-1">
            <ReactFlow<FlowNode, FlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onBeforeDelete={onBeforeDelete}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onEdgeDoubleClick={(_, edge) => setEditingEdgeId(edge.id)}
              onDragOver={onDragOver}
              onDrop={onDrop}
              connectionMode={ConnectionMode.Loose}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: "var(--flow-accent)", strokeWidth: 2 }}
              deleteKeyCode={["Backspace", "Delete"]}
              multiSelectionKeyCode="Shift"
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              panOnDrag={[1, 2]}
              panOnScroll
              zoomOnDoubleClick={false}
              elevateNodesOnSelect={false}
              snapToGrid
              snapGrid={[10, 10]}
              minZoom={0.1}
              maxZoom={3}
              colorMode="system"
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => (n as FlowNode).data.color}
                nodeStrokeWidth={0}
                maskColor="var(--flow-minimap-mask)"
              />
            </ReactFlow>
          </div>
          <Inspector nodes={selectedNodes} edges={selectedEdges} />
        </div>
      </div>
      {figjamCode !== null && (
        <FigJamDialog
          code={figjamCode}
          filename={slug(title)}
          onClose={() => setFigjamCode(null)}
        />
      )}
    </EditorContext.Provider>
  );
}

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
