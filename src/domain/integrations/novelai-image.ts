import { KOREA_UTC_OFFSET_MILLISECONDS } from "@/constants/platform/date";
import { NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE } from "@/constants/integrations/novelai";
import type { NovelAiImageContentType } from "@/types/integrations/novelai";

const KOREA_TIME_START_INDEX = 11;
const KOREA_TIME_END_INDEX = 23;
const TIME_SEPARATOR_PATTERN = /[:.]/gu;

export function isNovelAiImageContentType(
  contentType: string,
): contentType is NovelAiImageContentType {
  return Object.hasOwn(NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE, contentType);
}

export function novelAiImageFileName(
  timestamp: number,
  uniqueId: string,
  contentType: NovelAiImageContentType,
): string {
  const koreaTime = new Date(timestamp + KOREA_UTC_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(KOREA_TIME_START_INDEX, KOREA_TIME_END_INDEX)
    .replace(TIME_SEPARATOR_PATTERN, "-");
  const extension = NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType];
  return `${koreaTime}_${uniqueId}.${extension}`;
}
