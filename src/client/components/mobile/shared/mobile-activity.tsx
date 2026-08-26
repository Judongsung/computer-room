import type { ReactNode } from "react";
import { MOBILE_CLASS_NAME } from "@client/constants/shared/mobile";

interface MobileActivityProps {
  readonly title: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function MobileActivity({ title, actions, children }: MobileActivityProps) {
  return (
    <section className={MOBILE_CLASS_NAME.ACTIVITY} aria-label={title}>
      <header className={MOBILE_CLASS_NAME.ACTIVITY_HEADER}>
        <h1 className={MOBILE_CLASS_NAME.ACTIVITY_TITLE}>{title}</h1>
        {actions}
      </header>
      <div className={MOBILE_CLASS_NAME.ACTIVITY_CONTENT}>{children}</div>
    </section>
  );
}
