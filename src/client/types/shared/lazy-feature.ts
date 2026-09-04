import type { ReactNode } from "react";

export interface LazyFeatureBoundaryProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly inline?: boolean;
}

export interface LazyFeatureBoundaryState {
  readonly failed: boolean;
}
