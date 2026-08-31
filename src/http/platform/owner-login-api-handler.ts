import {
  ACCESS_LOGIN_PATH,
  ACCESS_MODE_OWNER_VALUE,
  ACCESS_MODE_QUERY_PARAMETER,
} from "@/constants/platform/auth";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
  PRIVATE_NO_STORE_RESPONSE_HEADERS,
} from "@/constants/platform/http";
import type { FeatureApiHandler } from "@/types/platform/http";
import { assertMethod } from "@/http/filesystem/filesystem-request";

export class OwnerLoginApiHandler implements FeatureApiHandler {
  async handle(request: Request, url: URL): Promise<Response | null> {
    if (url.pathname !== ACCESS_LOGIN_PATH) return null;
    assertMethod(request, HTTP_METHOD.GET);

    const destination = new URL("/", url.origin);
    destination.searchParams.set(
      ACCESS_MODE_QUERY_PARAMETER,
      ACCESS_MODE_OWNER_VALUE,
    );
    return new Response(null, {
      status: HTTP_STATUS.FOUND,
      headers: {
        ...PRIVATE_NO_STORE_RESPONSE_HEADERS,
        [HTTP_HEADERS.LOCATION]: destination.toString(),
      },
    });
  }
}
