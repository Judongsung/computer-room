import {
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  IMAGE_UPLOAD_FILE_NAME_TOKEN,
  IMAGE_UPLOAD_PATH_TOKEN,
  IMAGE_UPLOAD_PROFILE_ID_PATTERN,
  IMAGE_UPLOAD_PROFILE_LIMITS,
  IMAGE_UPLOAD_PROFILE_ROOT_IDS,
  IMAGE_UPLOAD_TEMPLATE_SAMPLE,
} from "@/constants/integrations/image-upload-profile";
import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import { KOREA_UTC_OFFSET_MILLISECONDS } from "@/constants/platform/date";
import { normalizeFilesystemName } from "@/domain/filesystem/filesystem-name";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { AppError } from "@/domain/shared/errors";
import type {
  ImageUploadContentType,
  ImageUploadProfileConfigurationInput,
  ImageUploadProfileRootId,
  ValidatedImageUploadProfileConfiguration,
} from "@/types/integrations/image-upload-profile";

const TEMPLATE_TOKEN_PATTERN = /\{[^{}]+\}/gu;
const TEMPLATE_BRACE_PATTERN = /[{}]/u;
const WHITESPACE_PATTERN = /\s+/gu;
const KOREA_TIME_START_INDEX = 11;
const KOREA_TIME_END_INDEX = 23;
const TIME_SEPARATOR_PATTERN = /[:.]/gu;

const PATH_TOKENS = new Set(Object.values(IMAGE_UPLOAD_PATH_TOKEN));
const FILE_NAME_TOKENS = new Set(Object.values(IMAGE_UPLOAD_FILE_NAME_TOKEN));
const SUPPORTED_CONTENT_TYPES = new Set<string>(
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
);

export interface ImageUploadTemplateContext {
  readonly profileId: string;
  readonly businessDate: string;
  readonly koreaTime: string;
  readonly uuid: string;
  readonly extension: string;
}

export function normalizeImageUploadProfileId(id: string): string {
  const normalized = id.normalize("NFC").trim();
  if (
    normalized.length < IMAGE_UPLOAD_PROFILE_LIMITS.ID_MIN_LENGTH ||
    normalized.length > IMAGE_UPLOAD_PROFILE_LIMITS.ID_MAX_LENGTH ||
    !IMAGE_UPLOAD_PROFILE_ID_PATTERN.test(normalized)
  ) {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_ID);
  }
  return normalized;
}

export function normalizeImageUploadProfileConfiguration(
  profileId: string,
  input: ImageUploadProfileConfigurationInput,
): ValidatedImageUploadProfileConfiguration {
  const normalizedProfileId = normalizeImageUploadProfileId(profileId);
  const displayName = input.displayName
    .normalize("NFC")
    .trim()
    .replace(WHITESPACE_PATTERN, " ");
  if (
    displayName.length < IMAGE_UPLOAD_PROFILE_LIMITS.DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > IMAGE_UPLOAD_PROFILE_LIMITS.DISPLAY_NAME_MAX_LENGTH
  ) {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_DISPLAY_NAME);
  }

  const rootId = IMAGE_UPLOAD_PROFILE_ROOT_IDS.find(
    (candidate) => candidate === input.rootId,
  );
  if (!rootId) {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_ROOT);
  }

  return {
    displayName,
    rootId,
    pathTemplate: normalizePathTemplate(
      normalizedProfileId,
      input.pathTemplate,
    ),
    fileNameTemplate: normalizeFileNameTemplate(
      normalizedProfileId,
      input.fileNameTemplate,
    ),
    enabled: input.enabled,
    contentTypes: normalizeContentTypes(input.contentTypes),
  };
}

export function renderImageUploadPathTemplate(
  template: string,
  context: ImageUploadTemplateContext,
): string[] {
  if (template === "") return [];
  return template.split("/").map((segment) => renderTemplate(segment, context));
}

export function renderImageUploadFileNameTemplate(
  template: string,
  context: ImageUploadTemplateContext,
): string {
  return renderTemplate(template, context);
}

export function createImageUploadTemplateContext(
  timestamp: number,
  profileId: string,
  uuid: string,
  extension: string,
): ImageUploadTemplateContext {
  return {
    profileId,
    businessDate: getKoreaDateContext(timestamp).businessDate,
    koreaTime: new Date(timestamp + KOREA_UTC_OFFSET_MILLISECONDS)
      .toISOString()
      .slice(KOREA_TIME_START_INDEX, KOREA_TIME_END_INDEX)
      .replace(TIME_SEPARATOR_PATTERN, "-"),
    uuid,
    extension,
  };
}

function normalizePathTemplate(profileId: string, input: string): string {
  const normalized = input.normalize("NFC").trim();
  if (normalized === "") return "";
  const segments = normalized.split("/");
  if (
    segments.length > IMAGE_UPLOAD_PROFILE_LIMITS.MAX_PATH_SEGMENTS ||
    segments.some((segment) => segment.length === 0)
  ) {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_PATH_TEMPLATE);
  }

  try {
    const canonicalSegments = segments.map((segment) => {
      const canonical = segment.normalize("NFC").trim();
      validateTemplateTokens(canonical, PATH_TOKENS);
      normalizeFilesystemName(
        renderTemplate(canonical, sampleContext(profileId)),
      );
      return canonical;
    });
    return canonicalSegments.join("/");
  } catch {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_PATH_TEMPLATE);
  }
}

function normalizeFileNameTemplate(profileId: string, input: string): string {
  const normalized = input.normalize("NFC").trim();
  try {
    validateTemplateTokens(normalized, FILE_NAME_TOKENS);
    if (
      countToken(normalized, IMAGE_UPLOAD_FILE_NAME_TOKEN.UUID) !== 1 ||
      countToken(normalized, IMAGE_UPLOAD_FILE_NAME_TOKEN.EXTENSION) !== 1
    ) {
      throw new Error("Required token count is invalid.");
    }
    normalizeFilesystemName(
      renderImageUploadFileNameTemplate(normalized, sampleContext(profileId)),
    );
    return normalized;
  } catch {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_FILE_NAME_TEMPLATE);
  }
}

function normalizeContentTypes(
  input: readonly string[],
): readonly ImageUploadContentType[] {
  const selected = new Set(input);
  if (
    selected.size === 0 ||
    [...selected].some((contentType) => !SUPPORTED_CONTENT_TYPES.has(contentType))
  ) {
    throw new AppError(IMAGE_UPLOAD_PROFILE_ERRORS.INVALID_CONTENT_TYPES);
  }
  return IMAGE_UPLOAD_CONTENT_TYPE_VALUES.filter((contentType) =>
    selected.has(contentType),
  );
}

function validateTemplateTokens(
  template: string,
  supportedTokens: ReadonlySet<string>,
): void {
  const tokens = template.match(TEMPLATE_TOKEN_PATTERN) ?? [];
  if (tokens.some((token) => !supportedTokens.has(token))) {
    throw new Error("Unsupported template token.");
  }
  if (TEMPLATE_BRACE_PATTERN.test(template.replace(TEMPLATE_TOKEN_PATTERN, ""))) {
    throw new Error("Malformed template token.");
  }
}

function renderTemplate(
  template: string,
  context: ImageUploadTemplateContext,
): string {
  const values = new Map<string, string>([
    [IMAGE_UPLOAD_FILE_NAME_TOKEN.PROFILE_ID, context.profileId],
    [IMAGE_UPLOAD_FILE_NAME_TOKEN.DATE, context.businessDate],
    [IMAGE_UPLOAD_FILE_NAME_TOKEN.TIME, context.koreaTime],
    [IMAGE_UPLOAD_FILE_NAME_TOKEN.UUID, context.uuid],
    [IMAGE_UPLOAD_FILE_NAME_TOKEN.EXTENSION, context.extension],
  ]);
  return template.replace(TEMPLATE_TOKEN_PATTERN, (token) => values.get(token) ?? token);
}

function sampleContext(profileId: string): ImageUploadTemplateContext {
  return {
    profileId,
    businessDate: IMAGE_UPLOAD_TEMPLATE_SAMPLE.BUSINESS_DATE,
    koreaTime: IMAGE_UPLOAD_TEMPLATE_SAMPLE.KOREA_TIME,
    uuid: IMAGE_UPLOAD_TEMPLATE_SAMPLE.UUID,
    extension: IMAGE_UPLOAD_TEMPLATE_SAMPLE.EXTENSION,
  };
}

function countToken(template: string, token: string): number {
  return template.split(token).length - 1;
}

export function isImageUploadProfileRootId(
  value: string,
): value is ImageUploadProfileRootId {
  return IMAGE_UPLOAD_PROFILE_ROOT_IDS.some((rootId) => rootId === value);
}
