import { useEffect } from "react";

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);
}
