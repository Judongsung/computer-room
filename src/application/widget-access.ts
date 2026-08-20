import { WIDGET_ERRORS } from "../constants/errors/widget";
import { AppError } from "../domain/errors";
import type { WidgetType } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";

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
