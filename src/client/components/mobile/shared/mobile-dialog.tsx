import type { ReactNode } from "react";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";

interface MobileDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly actions: ReactNode;
}

export function MobileDialog({ title, children, actions }: MobileDialogProps) {
  return (
    <div className={MOBILE_CLASS_NAME.DIALOG_BACKDROP} role="presentation">
      <section
        className={MOBILE_CLASS_NAME.DIALOG}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
        <div className={MOBILE_CLASS_NAME.BUTTON_ROW}>{actions}</div>
      </section>
    </div>
  );
}
