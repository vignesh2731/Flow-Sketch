import { MarkerType, type Edge, type Node, type XYPosition } from "@xyflow/react";

export type NodeKind =
  | "terminal"
  | "screen"
  | "action"
  | "decision"
  | "note"
  | "section";

export type FlowNodeData = {
  label: string;
  description?: string;
  color: string;
};

export type FlowEdgeData = {
  label?: string;
  dashed?: boolean;
  /** Optional bend point the connector is routed through (flow coordinates). */
  via?: XYPosition;
};

export type FlowNode = Node<FlowNodeData, NodeKind>;
export type FlowEdge = Edge<FlowEdgeData, "flow">;

export const COLORS = [
  "#64748b",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
];

export const ARROW = {
  type: MarkerType.ArrowClosed,
  width: 18,
  height: 18,
  color: "#94a3b8",
};

type KindSpec = {
  name: string;
  hint: string;
  label: string;
  description?: string;
  color: string;
  width?: number;
  height?: number;
  zIndex?: number;
};

export const KINDS: Record<NodeKind, KindSpec> = {
  terminal: {
    name: "Start / End",
    hint: "Entry or exit point",
    label: "Start",
    color: "#10b981",
  },
  screen: {
    name: "Screen",
    hint: "A page or view",
    label: "New screen",
    description: "",
    color: "#3b82f6",
    width: 200,
    height: 240,
  },
  action: {
    name: "Action",
    hint: "Something the user does",
    label: "User action",
    color: "#64748b",
  },
  decision: {
    name: "Decision",
    hint: "A branch in the flow",
    label: "Condition?",
    color: "#f59e0b",
  },
  note: {
    name: "Note",
    hint: "Sticky comment",
    label: "Add a note",
    color: "#f59e0b",
    width: 180,
    height: 120,
  },
  section: {
    name: "Section",
    hint: "Group a journey stage",
    label: "Stage",
    color: "#8b5cf6",
    width: 520,
    height: 340,
    zIndex: -1,
  },
};

// Fallback size used to centre nodes that size themselves to their content.
const AUTO_SIZE: Partial<Record<NodeKind, { width: number; height: number }>> = {
  terminal: { width: 120, height: 40 },
  action: { width: 150, height: 48 },
  decision: { width: 140, height: 140 },
};

export const nodeSize = (n: FlowNode) => ({
  width: n.measured?.width ?? n.width ?? 0,
  height: n.measured?.height ?? n.height ?? 0,
});

/** True when `node` sits entirely within `section`'s bounds. */
export function isInside(node: FlowNode, section: FlowNode) {
  const a = nodeSize(node);
  const b = nodeSize(section);
  return (
    node.position.x >= section.position.x &&
    node.position.y >= section.position.y &&
    node.position.x + a.width <= section.position.x + b.width &&
    node.position.y + a.height <= section.position.y + b.height
  );
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function createNode(kind: NodeKind, center: XYPosition): FlowNode {
  const spec = KINDS[kind];
  const size = spec.width
    ? { width: spec.width, height: spec.height ?? spec.width }
    : (AUTO_SIZE[kind] ?? { width: 0, height: 0 });
  return {
    id: uid("n"),
    type: kind,
    position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
    data: {
      label: spec.label,
      description: spec.description,
      color: spec.color,
    },
    selected: true,
    ...(spec.width ? { width: spec.width, height: spec.height } : {}),
    ...(spec.zIndex !== undefined ? { zIndex: spec.zIndex } : {}),
  };
}
