import type { ErrorDefinition } from "@/types/platform/error";

export class ClientError extends Error {
  readonly code: string;

  constructor(definition: ErrorDefinition) {
    super(definition.message);
    this.name = "ClientError";
    this.code = definition.code;
  }
}
