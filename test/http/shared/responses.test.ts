import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTP_ERRORS, HTTP_LOG_MESSAGES } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";
import { errorResponse } from "@/http/shared/responses";

afterEach(() => vi.restoreAllMocks());

describe("API error responses and logging", () => {
  it("logs only fixed classification and preserves the public response and headers", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new TypeError("private SQL and request", {
      cause: new Error("private file", { cause: "secret token" }),
    }), { privateValue: "secret", toJSON: () => "secret serialization" });
    const response = errorResponse(error, { "Cache-Control": "no-store" });
    expect(log).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      event: HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR, errorType: "TypeError",
    }));
    expect(response.status).toBe(HTTP_ERRORS.INTERNAL_ERROR.status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: {
      code: HTTP_ERRORS.INTERNAL_ERROR.code, message: HTTP_ERRORS.INTERNAL_ERROR.message,
    } });
  });

  it("does not read arbitrary error properties", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    class PrivateError extends Error {}
    const error = new PrivateError();
    const read = vi.fn(() => { throw new Error("must not be read"); });
    for (const key of ["name", "message", "stack", "cause", "toJSON", "constructor"]) {
      Object.defineProperty(error, key, { get: read });
    }
    errorResponse(error);
    expect(read).not.toHaveBeenCalled();
    expect(JSON.parse(log.mock.calls[0]![0])).toEqual({
      event: HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR, errorType: "Error",
    });
  });

  it.each([
    [new RangeError(), "RangeError"], [new SyntaxError(), "SyntaxError"],
    [new ReferenceError(), "ReferenceError"], [new URIError(), "URIError"],
    [new EvalError(), "EvalError"], [new AggregateError([]), "AggregateError"],
    [null, "null"], [undefined, "undefined"], ["secret", "string"],
    [1, "number"], [true, "boolean"], [1n, "bigint"],
    [Symbol("secret"), "symbol"], [{ message: "secret" }, "object"],
    [() => "secret", "function"],
  ])("classifies thrown value without serializing it (%#)", (value, expected) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    errorResponse(value);
    expect(log).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      event: HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR, errorType: expected,
    }));
  });

  it("keeps expected AppError responses without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const definition = HTTP_ERRORS.INVALID_JSON;
    const response = errorResponse(new AppError(definition));
    expect(response.status).toBe(definition.status);
    expect(await response.json()).toEqual({ error: { code: definition.code, message: definition.message } });
    expect(log).not.toHaveBeenCalled();
  });
});
