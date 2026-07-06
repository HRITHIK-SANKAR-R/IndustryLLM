import type { NodeGroup } from "./types";

// Design-system color tokens (see uiux.md §1.2 / §1.4).
export const COLORS = {
  bg: "#0B0F19",
  surface: "#111827",
  border: "#1F2937",
  accent: "#3B82F6", // Electric Blue — Equipment / primary
  success: "#10B981", // Emerald — Procedure / healthy
  warning: "#F59E0B", // Amber — Rule / maintenance
  danger: "#EF4444", // Crimson — violation / critical selection
} as const;

// Maps a graph node group to its render color.
export function nodeColor(group: NodeGroup): string {
  switch (group) {
    case "Equipment":
      return COLORS.accent;
    case "Rule":
      return COLORS.warning;
    case "Coordinate":
      return COLORS.success;
    default:
      return "#94A3B8"; // slate fallback
  }
}

// Category → accent for rule badges in the drawer.
export function categoryColor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("safety") || c.includes("compliance")) return COLORS.danger;
  if (c.includes("maint")) return COLORS.warning;
  return COLORS.accent;
}
