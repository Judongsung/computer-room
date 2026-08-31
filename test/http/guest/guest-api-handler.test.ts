import { describe, expect, it, vi } from "vitest";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { GUEST_RATE_LIMIT } from "@/constants/guest/guest";
import { GUEST_API_PATHS } from "@/constants/platform/api";
import { HTTP_HEADERS, HTTP_STATUS } from "@/constants/platform/http";
import { GuestApiHandler } from "@/http/guest/guest-api-handler";
import type {
  GuestRequestRateLimiter,
  GuestUseCases,
} from "@/types/guest/guest-service";

describe("GuestApiHandler rate limiting", () => {
  it("returns 429 with Retry-After before reading guest data", async () => {
    const getSession = vi.fn();
    const handler = new GuestApiHandler(
      { getSession } as unknown as GuestUseCases,
      { allow: vi.fn().mockResolvedValue(false) } satisfies GuestRequestRateLimiter,
    );
    const request = new Request(`https://example.com${GUEST_API_PATHS.SESSION}`);

    const response = await handler.handle(request, new URL(request.url));

    expect(response?.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(response?.headers.get(HTTP_HEADERS.RETRY_AFTER)).toBe(
      String(GUEST_RATE_LIMIT.RETRY_AFTER_SECONDS),
    );
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: GUEST_ERRORS.RATE_LIMITED.code,
        message: GUEST_ERRORS.RATE_LIMITED.message,
      },
    });
    expect(getSession).not.toHaveBeenCalled();
  });
});
