import { GUEST_RATE_LIMIT_CATEGORY } from "@/constants/guest/guest";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import { HTTP_HEADERS } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import type {
  GuestRateLimitCategory,
  GuestRequestRateLimiter,
} from "@/types/guest/guest-service";

export class CloudflareGuestRequestRateLimiter
  implements GuestRequestRateLimiter
{
  constructor(
    private readonly metadata: RateLimit,
    private readonly binary: RateLimit,
  ) {}

  async allow(
    request: Request,
    category: GuestRateLimitCategory,
  ): Promise<boolean> {
    const limiter =
      category === GUEST_RATE_LIMIT_CATEGORY.BINARY
        ? this.binary
        : this.metadata;
    const key =
      request.headers.get(HTTP_HEADERS.CF_CONNECTING_IP) ??
      new URL(request.url).hostname;
    try {
      return (await limiter.limit({ key })).success;
    } catch {
      throw new AppError(GUEST_ERRORS.RATE_LIMIT_UNAVAILABLE);
    }
  }
}
