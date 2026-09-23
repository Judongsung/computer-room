import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { API_ROUTE_PATTERN } from "@/constants/platform/http-route";
import { HTTP_METHOD } from "@/constants/platform/http";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { AppError } from "@/domain/shared/errors";
import { isMemoUpdateInput } from "@/domain/widgets/widget-contract";
import {
  createExactApiRoutePattern,
  readApiRouteSegment,
} from "@/http/shared/api-route";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import { assertMethod } from "@/http/widgets/widget-http";
import type { MemoUseCases } from "@/types/widgets/memo-service";

const MEMO_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.MEMO,
);
const MEMO_VERSIONS_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.MEMO,
  API_PATH_SEGMENTS.VERSIONS,
);
const MEMO_VERSION_PATH = createExactApiRoutePattern(
  API_PATHS.WIDGETS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
  API_PATH_SEGMENTS.MEMO,
  API_PATH_SEGMENTS.VERSIONS,
  API_ROUTE_PATTERN.CAPTURED_SEGMENT,
);

export class MemoApiRoutes {
  constructor(private readonly memos: MemoUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const versionMatch = MEMO_VERSION_PATH.exec(url.pathname);
    if (versionMatch) {
      assertMethod(request, HTTP_METHOD.GET);
      const versionSegment = readApiRouteSegment(versionMatch, 2);
      const version = Number(versionSegment);
      if (!Number.isSafeInteger(version) || version <= 0 || String(version) !== versionSegment) {
        throw new AppError(MEMO_ERRORS.INVALID_VERSION);
      }
      return jsonResponse(await this.memos.getMemoVersion(readApiRouteSegment(versionMatch), version));
    }
    const versionsMatch = MEMO_VERSIONS_PATH.exec(url.pathname);
    if (versionsMatch) {
      assertMethod(request, HTTP_METHOD.GET);
      return jsonResponse(await this.memos.listMemoVersions(readApiRouteSegment(versionsMatch)));
    }
    const match = MEMO_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isMemoUpdateInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse(
      await this.memos.updateMemo(readApiRouteSegment(match), body),
    );
  }
}
