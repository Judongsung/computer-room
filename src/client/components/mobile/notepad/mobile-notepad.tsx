import { lazy } from "react";
import { NOTEPAD_CLASS_NAME } from "@client/constants/filesystem/text/notepad";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";
import type { TextDocumentProps } from "@client/types/filesystem/text/files";

const TextDocument = lazy(() => import("@client/components/shared/text/text-document").then((module) => ({ default: module.TextDocument })));

export function MobileNotepad({ file, gateway }: TextDocumentProps) {
  return (
    <MobileActivity title={NOTEPAD_COPY.WINDOW_TITLE(file.name)}>
      <div className={NOTEPAD_CLASS_NAME.MOBILE}>
        <LazyFeatureBoundary title={NOTEPAD_COPY.TITLE} inline>
          <TextDocument key={file.id} file={file} gateway={gateway} wrap="soft" />
        </LazyFeatureBoundary>
      </div>
    </MobileActivity>
  );
}
