import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { HTTP_METHOD } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";
import { isMemoUpdateInput } from "@/domain/widgets/widget-contract";
import { readJsonBody } from "@/http/shared/request-body";
import { jsonResponse } from "@/http/shared/responses";
import { assertMethod, decodeId } from "@/http/widgets/widget-http";
import type { MemoUseCases } from "@/types/widgets/memo-service";

const MEMO_PATH = new RegExp(`^${API_PATHS.WIDGETS}/([^/]+)/${API_PATH_SEGMENTS.MEMO}$`);

export class MemoApiRoutes {
  constructor(private readonly memos: MemoUseCases) {}

  async handle(request: Request, url: URL): Promise<Response | null> {
    const match = MEMO_PATH.exec(url.pathname);
    if (!match) return null;
    assertMethod(request, HTTP_METHOD.PUT);
    const body = await readJsonBody(request);
    if (!isMemoUpdateInput(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
    return jsonResponse(await this.memos.updateMemo(decodeId(match[1]), body));
  }
}
