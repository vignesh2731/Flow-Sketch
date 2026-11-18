"use client";

import { createContext, useContext } from "react";

export type EditorContextValue = {
  takeSnapshot: () => void;
  editingEdgeId: string | null;
  setEditingEdgeId: (id: string | null) => void;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside EditorContext");
  return value;
}
