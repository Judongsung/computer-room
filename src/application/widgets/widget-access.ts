import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import { AppError } from "@/domain/shared/errors";
import type { WidgetType } from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";

export async function requireWidgetType(
  repository: WidgetLayoutRepository,
  widgetId: string,
  expectedType: WidgetType,
): Promise<void> {
  const widget = await repository.findById(widgetId);
  if (!widget) {
    throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
  }
  if (widget.type !== expectedType) {
    throw new AppError(WIDGET_ERRORS.WIDGET_TYPE_MISMATCH);
  }
}
