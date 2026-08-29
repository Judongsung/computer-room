import type { ErrorDefinition } from "@/types/platform/error";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";
import { CLIENT_ERROR_MESSAGE } from "@client/content/ko/shared/errors";

export type ClientErrorCode =
  (typeof CLIENT_ERROR_CODE)[keyof typeof CLIENT_ERROR_CODE];

export function clientErrorDefinition(code: ClientErrorCode): ErrorDefinition {
  return { code, message: CLIENT_ERROR_MESSAGE[code] };
}

export class ClientError extends Error {
  readonly code: string;

  constructor(definitionOrCode: ClientErrorCode | ErrorDefinition) {
    const definition = typeof definitionOrCode === "string"
      ? clientErrorDefinition(definitionOrCode)
      : definitionOrCode;
    super(definition.message);
    this.name = "ClientError";
    this.code = definition.code;
  }
}
