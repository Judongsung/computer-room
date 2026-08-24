import { CHECKLIST_ITEM_LABEL_MAX_LENGTH } from "@/constants/widgets/checklist";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { AppError } from "@/domain/shared/errors";

export function normalizeChecklistLabel(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(CHECKLIST_ERRORS.INVALID_LABEL);
  }

  const label = value.trim();
  if (
    label.length === 0 ||
    label.length > CHECKLIST_ITEM_LABEL_MAX_LENGTH
  ) {
    throw new AppError(CHECKLIST_ERRORS.INVALID_LABEL);
  }
  return label;
}
