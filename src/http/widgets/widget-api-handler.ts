import { ChecklistApiRoutes } from "@/http/widgets/checklist-api-routes";
import { MemoApiRoutes } from "@/http/widgets/memo-api-routes";
import { WidgetLifecycleApiRoutes } from "@/http/widgets/widget-lifecycle-api-routes";
import type { FeatureApiHandler } from "@/types/platform/http";
import type { ChecklistUseCases } from "@/types/widgets/checklist-service";
import type { MemoUseCases } from "@/types/widgets/memo-service";
import type { WidgetLayoutUseCases } from "@/types/widgets/widget-service";
import type { WidgetFileUseCases } from "@/types/widgets/widget-file-service";

export class WidgetApiHandler implements FeatureApiHandler {
  private readonly handlers: readonly WidgetRouteHandler[];

  constructor(
    widgets: WidgetLayoutUseCases,
    widgetFiles: WidgetFileUseCases,
    memos: MemoUseCases,
    checklists: ChecklistUseCases,
  ) {
    this.handlers = [
      new WidgetLifecycleApiRoutes(widgets, widgetFiles),
      new MemoApiRoutes(memos),
      new ChecklistApiRoutes(checklists),
    ];
  }

  async handle(request: Request, url: URL): Promise<Response | null> {
    for (const handler of this.handlers) {
      const response = await handler.handle(request, url);
      if (response !== null) return response;
    }
    return null;
  }
}

interface WidgetRouteHandler {
  handle(request: Request, url: URL): Promise<Response | null>;
}
