import { ARROW, type FlowEdge, type FlowNode } from "./types";

const KEY = "flow-sketch:v1";

export type FlowDoc = {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export function parseDoc(raw: string): FlowDoc | null {
  const doc = JSON.parse(raw);
  if (!doc || !Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    return null;
  }
  return {
    title: typeof doc.title === "string" ? doc.title : "Untitled flow",
    nodes: doc.nodes,
    edges: doc.edges,
  };
}

export function loadDoc(): FlowDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseDoc(raw) : null;
  } catch {
    return null;
  }
}

export function saveDoc(doc: FlowDoc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Storage can be full or blocked; the canvas keeps working without it.
  }
}

/** A small sign-up journey shown the first time the app opens. */
export function sampleDoc(): FlowDoc {
  const node = (
    id: string,
    type: FlowNode["type"],
    x: number,
    y: number,
    label: string,
    color: string,
    extra: Partial<FlowNode> = {},
    description?: string,
  ): FlowNode => ({
    id,
    type,
    position: { x, y },
    data: { label, color, description },
    ...extra,
  });

  const edge = (
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string,
    data: FlowEdge["data"] = {},
  ): FlowEdge => ({
    id,
    type: "flow",
    source,
    target,
    sourceHandle,
    targetHandle,
    markerEnd: ARROW,
    data,
  });

  return {
    title: "Sign-up journey",
    nodes: [
      node("sec", "section", 560, 20, "Onboarding", "#8b5cf6", {
        width: 700,
        height: 400,
        zIndex: -1,
      }),
      node("start", "terminal", 0, 190, "Open app", "#10b981"),
      node(
        "landing",
        "screen",
        170,
        90,
        "Landing",
        "#3b82f6",
        { width: 200, height: 240 },
        "Hero, value prop and a primary “Sign up” button.",
      ),
      node("tap", "action", 410, 186, "Tap “Sign up”", "#64748b"),
      node(
        "form",
        "screen",
        600,
        90,
        "Sign-up form",
        "#3b82f6",
        { width: 200, height: 240 },
        "Email, password, accept terms.",
      ),
      node("valid", "decision", 860, 140, "Details valid?", "#f59e0b"),
      node(
        "welcome",
        "screen",
        1040,
        90,
        "Welcome",
        "#3b82f6",
        { width: 200, height: 240 },
        "Personalise: pick interests, enable notifications.",
      ),
      node("done", "terminal", 1310, 190, "Home feed", "#10b981"),
      node(
        "note",
        "note",
        170,
        380,
        "Consider Google / Apple sign-in to cut form friction.",
        "#f59e0b",
        { width: 200, height: 110 },
      ),
    ],
    edges: [
      edge("e1", "start", "landing", "right", "left"),
      edge("e2", "landing", "tap", "right", "left"),
      edge("e3", "tap", "form", "right", "left"),
      edge("e4", "form", "valid", "right", "left"),
      edge("e5", "valid", "welcome", "right", "left", { label: "Yes" }),
      edge("e6", "valid", "form", "bottom", "bottom", {
        label: "No – show errors",
        dashed: true,
      }),
      edge("e7", "welcome", "done", "right", "left"),
    ],
  };
}
