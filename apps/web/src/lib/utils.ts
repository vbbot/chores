import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge does not know the design tokens in tailwind.config.ts.
 * Without this extension, `border-heavy` silently drops `border-foreground`
 * and cards fall back to Tailwind's default grey border.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "border-color": [{ border: ["foreground", "border", "secondary", "background", "destructive", "success"] }],
      "bg-color": [{ bg: ["background", "surface", "foreground", "secondary", "destructive", "success"] }],
      "text-color": [{ text: ["foreground", "secondary", "background", "destructive", "success"] }],
      "border-w": ["border-heavy"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPenceToPounds(pence: number | null): string {
  if (pence === null || pence === undefined) return "Unstated";
  return `£${(pence / 100).toFixed(2)}`;
}

export function formatDayName(dayIndex: number): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayIndex] ?? "Unknown";
}
