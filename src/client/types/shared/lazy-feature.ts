import type { ReactNode } from "react";

export interface LazyFeatureBoundaryProps {
  readonly title: string;
  readonly children: ReactNode;
}

export interface LazyFeatureBoundaryState {
  readonly failed: boolean;
}
