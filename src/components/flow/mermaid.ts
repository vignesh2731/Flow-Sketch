import { isInside, nodeSize, type FlowEdge, type FlowNode } from "./types";

/** Mermaid labels are wrapped in double quotes; keep them on one line. */
function text(value: string) {
  const clean = value.replace(/"/g, "#quot;").replace(/\s+/g, " ").trim();
  return clean || " ";
}

function shape(node: FlowNode) {
  const label = text(
    node.type === "note" ? `Note: ${node.data.label}` : node.data.label,
  );
  switch (node.type) {
    case "terminal":
      return `(["${label}"])`;
    case "decision":
      return `{"${label}"}`;
    default:
      return `["${label}"]`;
  }
}

/**
 * Converts the canvas into a Mermaid flowchart. FigJam plugins such as
 * "Mermaid to FigJam" turn this into native, editable shapes and connectors.
 * Sections become subgraphs holding the nodes that sit inside them.
 */
export function toMermaid(nodes: FlowNode[], edges: FlowEdge[]): string {
  // Mermaid ids must be simple words, so number everything.
  const ids = new Map(nodes.map((n, i) => [n.id, `n${i + 1}`]));
  const sections = nodes.filter((n) => n.type === "section");
  const shapes = nodes.filter((n) => n.type !== "section");

  // Put each node (sections included) in the smallest section that fully
  // contains it, so sections drawn inside sections nest as subgraphs.
  const area = (n: FlowNode) => nodeSize(n).width * nodeSize(n).height;
  const children = new Map<string, FlowNode[]>([["", []]]);
  for (const s of sections) children.set(s.id, []);
  for (const node of nodes) {
    const home = sections
      .filter((s) => s.id !== node.id && isInside(node, s) && area(s) > area(node))
      .sort((a, b) => area(a) - area(b))[0];
    children.get(home?.id ?? "")!.push(node);
  }

  // Lay out left-to-right for wide flows, top-down for tall ones.
  const xs = shapes.map((n) => n.position.x);
  const ys = shapes.map((n) => n.position.y);
  const wide =
    shapes.length === 0 ||
    Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);

  const lines = [`flowchart ${wide ? "LR" : "TB"}`];
  const emit = (parentId: string, depth: number) => {
    const pad = "  ".repeat(depth);
    for (const node of children.get(parentId)!) {
      const id = ids.get(node.id);
      if (node.type !== "section") {
        lines.push(`${pad}${id}${shape(node)}`);
        continue;
      }
      lines.push(`${pad}subgraph ${id}["${text(node.data.label)}"]`);
      emit(node.id, depth + 1);
      lines.push(`${pad}end`);
    }
  };
  emit("", 1);
  for (const edge of edges) {
    const source = ids.get(edge.source);
    const target = ids.get(edge.target);
    if (!source || !target) continue;
    const arrow = edge.data?.dashed ? "-.->" : "-->";
    const label = edge.data?.label?.trim();
    lines.push(
      `  ${source} ${arrow}${label ? `|"${text(label)}"|` : ""} ${target}`,
    );
  }
  return lines.join("\n") + "\n";
}
