import { describe, expect, it, vi } from "vitest";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { GUEST_RATE_LIMIT_CATEGORY } from "@/constants/guest/guest";
import { HTTP_HEADERS } from "@/constants/platform/http";
import { CloudflareGuestRequestRateLimiter } from "@/infrastructure/guest/cloudflare-guest-request-rate-limiter";

describe("CloudflareGuestRequestRateLimiter", () => {
  it("uses the client IP and the selected category binding", async () => {
    const metadata = binding(true);
    const binary = binding(true);
    const limiter = new CloudflareGuestRequestRateLimiter(
      metadata.value,
      binary.value,
    );
    const request = new Request("https://example.com/api/guest/session", {
      headers: { [HTTP_HEADERS.CF_CONNECTING_IP]: "203.0.113.8" },
    });

    await expect(
      limiter.allow(request, GUEST_RATE_LIMIT_CATEGORY.BINARY),
    ).resolves.toBe(true);
    expect(binary.limit).toHaveBeenCalledWith({ key: "203.0.113.8" });
    expect(metadata.limit).not.toHaveBeenCalled();
  });

  it("fails closed when the Cloudflare binding cannot be queried", async () => {
    const unavailable = binding(false, new Error("binding unavailable"));
    const limiter = new CloudflareGuestRequestRateLimiter(
      unavailable.value,
      binding(true).value,
    );

    await expect(
      limiter.allow(
        new Request("https://example.com/api/guest/session"),
        GUEST_RATE_LIMIT_CATEGORY.METADATA,
      ),
    ).rejects.toMatchObject({
      code: GUEST_ERRORS.RATE_LIMIT_UNAVAILABLE.code,
      status: GUEST_ERRORS.RATE_LIMIT_UNAVAILABLE.status,
    });
  });
});

function binding(success: boolean, error?: Error) {
  const limit = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue({ success });
  return { limit, value: { limit } as unknown as RateLimit };
}
