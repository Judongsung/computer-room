import type { AppErrorDefinition } from "@/types/platform/error";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(definition: AppErrorDefinition) {
    super(definition.message);
    this.name = "AppError";
    this.status = definition.status;
    this.code = definition.code;
  }
}
