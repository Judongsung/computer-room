import type { NewWidgetFileDraft } from "@/types/widgets/widget-file";

export interface WidgetFileDraftRepository {
  insert(draft: NewWidgetFileDraft): Promise<void>;
}
