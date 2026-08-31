import { useEffect, useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { GuestProgramDocument } from "@/types/guest/guest";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { GUEST_MOBILE_CLASS_NAME } from "@client/constants/guest/guest";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import type { GuestGateway } from "@client/types/guest/guest";

interface GuestMobileProgramDocumentProps {
  readonly entryId: string;
  readonly title: string;
  readonly gateway: GuestGateway;
}

export function GuestMobileProgramDocument({
  entryId,
  title,
  gateway,
}: GuestMobileProgramDocumentProps) {
  const [document, setDocument] = useState<GuestProgramDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setError(null);
    void gateway.getProgramDocument(entryId).then(
      (value) => {
        if (active) setDocument(value);
      },
      () => {
        if (active) setError(GUEST_COPY.PROGRAM_LOAD_FAILED);
      },
    );
    return () => {
      active = false;
    };
  }, [entryId, gateway]);

  return (
    <MobileActivity title={document?.entry.name ?? title}>
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
      {!document && !error ? (
        <p className={MOBILE_CLASS_NAME.MESSAGE}>{MOBILE_COPY.LOADING}</p>
      ) : null}
      {document ? (
        <div className={GUEST_MOBILE_CLASS_NAME.PROGRAM}>
          {document.type === WIDGET_TYPE.MEMO ? (
            <MarkdownContent markdown={document.data.markdown} />
          ) : (
            <div className={GUEST_MOBILE_CLASS_NAME.CHECKLIST}>
              <p>{GUEST_COPY.CHECKLIST_DATE(document.data.businessDate)}</p>
              <ul>
                {document.data.items.map((item) => (
                  <li key={item.id}>
                    <input type="checkbox" checked={item.checked} readOnly />
                    {item.checked ? <del>{item.label}</del> : <span>{item.label}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </MobileActivity>
  );
}
