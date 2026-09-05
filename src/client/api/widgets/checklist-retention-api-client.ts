import { CHECKLIST_SETTINGS_API_PATH } from "@/constants/platform/api";
import { HTTP_METHOD } from "@/constants/platform/http";
import { isChecklistRetentionDays } from "@/domain/widgets/checklist-retention";
import type { ChecklistRetentionSettings, ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";
import { isRecord } from "@client/api/shared/api-contract";
import { jsonRequest, requestJson } from "@client/api/shared/api-request";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { ClientError } from "@client/errors/client-error";

async function requestSettings(options?: RequestInit): Promise<ChecklistRetentionSettings> {
  const payload = await requestJson(CHECKLIST_SETTINGS_API_PATH, options);
  if (!isRecord(payload) || !isRecord(payload.settings)
    || !isChecklistRetentionDays(payload.settings.retentionDays)) {
    throw new ClientError(CLIENT_ERROR_CODE.INVALID_RESPONSE);
  }
  return { retentionDays: payload.settings.retentionDays };
}

export const checklistRetentionApi: ChecklistRetentionUseCases = {
  getSettings: () => requestSettings(),
  updateRetentionDays: (retentionDays) => requestSettings(jsonRequest(HTTP_METHOD.PATCH, { retentionDays })),
};
