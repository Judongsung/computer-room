import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { THUMBNAIL_LOAD_POLICY } from "../constants/thumbnail";
import { ThumbnailLoadCoordinator } from "../domain/thumbnail-load-coordinator";
import type { ThumbnailLoadScheduler } from "../types/thumbnail";

const ThumbnailLoadContext = createContext<ThumbnailLoadScheduler | null>(null);

interface ThumbnailLoadProviderProps {
  readonly children: ReactNode;
  readonly coordinator?: ThumbnailLoadScheduler;
}

export function ThumbnailLoadProvider({
  children,
  coordinator,
}: ThumbnailLoadProviderProps) {
  const defaultCoordinator = useRef<ThumbnailLoadCoordinator | null>(null);
  if (defaultCoordinator.current === null) {
    defaultCoordinator.current = new ThumbnailLoadCoordinator(
      THUMBNAIL_LOAD_POLICY.MAX_CONCURRENT_REQUESTS,
    );
  }

  return (
    <ThumbnailLoadContext.Provider
      value={coordinator ?? defaultCoordinator.current}
    >
      {children}
    </ThumbnailLoadContext.Provider>
  );
}

export function useThumbnailLoadScheduler(): ThumbnailLoadScheduler {
  const coordinator = useContext(ThumbnailLoadContext);
  if (!coordinator) {
    throw new Error("ThumbnailLoadProvider is required");
  }
  return coordinator;
}
