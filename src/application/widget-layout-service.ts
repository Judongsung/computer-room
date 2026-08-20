import { validateWidgetLayout } from "../domain/widget-layout-validation";
import type { WidgetLayout } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";
import type { WidgetLayoutUseCases } from "../types/widget-service";

export class WidgetLayoutService implements WidgetLayoutUseCases {
  constructor(private readonly repository: WidgetLayoutRepository) {}

  async listWidgets(): Promise<WidgetLayout[]> {
    return this.repository.list();
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<WidgetLayout[]> {
    const validatedWidgets = validateWidgetLayout(widgets);
    await this.repository.replaceAll(validatedWidgets);
    return validatedWidgets;
  }
}
