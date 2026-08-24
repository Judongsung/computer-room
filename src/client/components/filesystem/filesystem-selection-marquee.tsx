import type { CSSProperties } from "react";
import type { FilesystemMarqueeBounds } from "@client/hooks/filesystem/use-filesystem-marquee-selection";

export function FilesystemSelectionMarquee({
  bounds,
}: {
  readonly bounds: FilesystemMarqueeBounds | null;
}) {
  if (!bounds) return null;
  return (
    <div
      className="filesystem-selection-marquee"
      style={bounds as CSSProperties}
      aria-hidden="true"
    />
  );
}
