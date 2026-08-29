import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { XpContextMenu } from "@client/components/context-menu/xp-context-menu";
import { XP_CONTEXT_MENU_CLASS_NAME } from "@client/constants/context-menu/context-menu";
import { useXpContextMenuRuntime } from "@client/hooks/context-menu/use-xp-context-menu-runtime";
import type { XpContextMenuController } from "@client/types/context-menu/context-menu";

const XpContextMenuContext = createContext<XpContextMenuController | null>(
  null,
);

export function XpContextMenuProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const runtime = useXpContextMenuRuntime();
  return (
    <XpContextMenuContext.Provider value={runtime.controller}>
      {children}
      {runtime.request ? (
        <XpContextMenu
          request={runtime.request}
          position={runtime.position}
          menuRef={runtime.menuRef}
          onClose={runtime.controller.close}
          onError={runtime.controller.reportError}
        />
      ) : null}
      {runtime.error ? (
        <div className={XP_CONTEXT_MENU_CLASS_NAME.ERROR} role="alert">
          {runtime.error}
        </div>
      ) : null}
    </XpContextMenuContext.Provider>
  );
}

export function useXpContextMenu(): XpContextMenuController {
  const value = useContext(XpContextMenuContext);
  if (!value) throw new Error("XpContextMenuProvider is required.");
  return value;
}
