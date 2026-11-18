"use client";

import dynamic from "next/dynamic";

// The editor reads localStorage on first render, so it only runs in the browser.
const FlowEditor = dynamic(() => import("./FlowEditor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-zinc-500">
      Loading canvas…
    </div>
  ),
});

export default function EditorLoader() {
  return <FlowEditor />;
}
