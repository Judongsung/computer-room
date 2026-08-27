import { ClientError } from "@client/errors/client-error";

export class ApiError extends ClientError {
  constructor(
    code: string,
    message: string,
    readonly status: number,
  ) {
    super({ code, message });
    this.name = "ApiError";
  }
}
