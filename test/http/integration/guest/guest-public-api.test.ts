import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { GUEST_ERRORS } from "@/constants/guest/errors/guest";
import {
  API_PATHS,
  FILESYSTEM_API_PATHS,
  GUEST_ACCESS_API_PATH,
  GUEST_ACCESS_API_PATHS,
  GUEST_API_PATHS,
} from "@/constants/platform/api";
import { ACCESS_LOGIN_PATH } from "@/constants/platform/auth";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  HTTP_HEADERS,
  HTTP_METHOD,
  HTTP_STATUS,
} from "@/constants/platform/http";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";
import type { GuestProgramDocument } from "@/types/guest/guest";
import {
  ORIGIN,
  jsonRequest,
  resetWorkerState,
  uploadFile,
} from "@test/support/http/worker-api-harness";

beforeEach(resetWorkerState);

describe("guest public API", () => {
  it("reports the disabled-by-default guest session without owner authentication", async () => {
    const response = await SELF.fetch(`${ORIGIN}${GUEST_API_PATHS.SESSION}`);

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(response.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    expect(response.headers.get(HTTP_HEADERS.CROSS_ORIGIN_RESOURCE_POLICY)).toBe(
      "same-origin",
    );
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      loginUrl: ACCESS_LOGIN_PATH,
    });
  });

  it("returns one uniform not-found response while access is disabled or private", async () => {
    const file = await uploadedFile("private.png");
    const disabled = await guestDownload(file.id);
    expect(disabled.status).toBe(HTTP_STATUS.NOT_FOUND);

    await setGuestEnabled(true);
    const privateResponse = await guestDownload(file.id);
    expect(privateResponse.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(
      privateResponse.headers.get(HTTP_HEADERS.CROSS_ORIGIN_RESOURCE_POLICY),
    ).toBe("same-origin");
    await expect(privateResponse.json()).resolves.toEqual({
      error: {
        code: GUEST_ERRORS.RESOURCE_NOT_FOUND.code,
        message: GUEST_ERRORS.RESOURCE_NOT_FOUND.message,
      },
    });
  });

  it("shows private ancestor folders only as navigation containers", async () => {
    const outer = await createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "private-outer",
    );
    const inner = await createDirectory(outer.id, "private-inner");
    const published = await uploadedFile("published.png", inner.id);
    await uploadedFile("private-sibling.png", inner.id);
    await setPublished(published.id, true);
    await setGuestEnabled(true);

    const documents = await guestDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS);
    expect(documents.items.map((item) => item.id)).toEqual([outer.id]);
    const outerPage = await guestDirectory(outer.id);
    expect(outerPage.items.map((item) => item.id)).toEqual([inner.id]);
    const innerPage = await guestDirectory(inner.id);
    expect(innerPage.items.map((item) => item.id)).toEqual([published.id]);
    expect(innerPage.breadcrumbs.map((item) => item.id)).toEqual([
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      outer.id,
      inner.id,
    ]);
  });

  it("streams and downloads only an exactly published file", async () => {
    const upload = await uploadFile(
      "public.png",
      "public-image",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "image/png",
    );
    const file = (await upload.json()) as { file: { id: string } };
    await setPublished(file.file.id, true);
    await setGuestEnabled(true);

    const content = await SELF.fetch(
      `${ORIGIN}${GUEST_API_PATHS.FILES}/${file.file.id}/content`,
    );
    expect(content.status).toBe(HTTP_STATUS.OK);
    expect(content.headers.get(HTTP_HEADERS.CACHE_CONTROL)).toBe(
      "private, no-store",
    );
    expect(content.headers.get(HTTP_HEADERS.CROSS_ORIGIN_RESOURCE_POLICY)).toBe(
      "same-origin",
    );
    await expect(responseText(content)).resolves.toBe("public-image");

    const download = await guestDownload(file.file.id);
    expect(download.status).toBe(HTTP_STATUS.OK);
    expect(download.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION)).toContain(
      "attachment",
    );
    await expect(responseText(download)).resolves.toBe("public-image");
  });

  it("returns read-only memo documents without window layout", async () => {
    const created = await jsonRequest(
      API_PATHS.WIDGET_FILES,
      HTTP_METHOD.POST,
      {
        type: WIDGET_TYPE.MEMO,
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        name: "public memo",
        data: { markdown: "# shared" },
      },
    );
    const body = (await created.json()) as {
      entry: { id: string };
    };
    await setPublished(body.entry.id, true);
    await setGuestEnabled(true);

    const response = await SELF.fetch(
      `${ORIGIN}${GUEST_API_PATHS.PROGRAM_DOCUMENTS}/${body.entry.id}`,
    );
    expect(response.status).toBe(HTTP_STATUS.OK);
    const document = (await response.json()) as GuestProgramDocument;
    expect(document.type).toBe(WIDGET_TYPE.MEMO);
    expect(document.data).toMatchObject({ markdown: "# shared" });
    expect(document).not.toHaveProperty("widget");
    expect(document).not.toHaveProperty("layout");
  });

  it("does not expose owner routes through the guest namespace", async () => {
    await setGuestEnabled(true);
    const unknown = await SELF.fetch(`${ORIGIN}${API_PATHS.GUEST}/widgets`);
    expect(unknown.status).toBe(HTTP_STATUS.NOT_FOUND);
    const write = await SELF.fetch(`${ORIGIN}${GUEST_API_PATHS.SESSION}`, {
      method: HTTP_METHOD.POST,
    });
    expect(write.status).toBe(HTTP_STATUS.METHOD_NOT_ALLOWED);
  });
});

async function createDirectory(parentId: string, name: string) {
  const response = await jsonRequest(
    FILESYSTEM_API_PATHS.DIRECTORIES,
    HTTP_METHOD.POST,
    { parentId, name },
  );
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return ((await response.json()) as { directory: { id: string } }).directory;
}

async function setGuestEnabled(enabled: boolean): Promise<void> {
  const response = await jsonRequest(
    GUEST_ACCESS_API_PATH,
    HTTP_METHOD.PATCH,
    { enabled },
  );
  expect(response.status).toBe(HTTP_STATUS.OK);
}

async function setPublished(entryId: string, published: boolean): Promise<void> {
  const response = await jsonRequest(
    `${GUEST_ACCESS_API_PATHS.ENTRIES}/${entryId}`,
    HTTP_METHOD.PUT,
    { published },
  );
  expect(response.status).toBe(HTTP_STATUS.OK);
}

async function guestDirectory(id: string): Promise<FilesystemDirectoryPage> {
  const response = await SELF.fetch(
    `${ORIGIN}${GUEST_API_PATHS.DIRECTORIES}/${id}`,
  );
  expect(response.status).toBe(HTTP_STATUS.OK);
  return (await response.json()) as FilesystemDirectoryPage;
}

function guestDownload(id: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${GUEST_API_PATHS.FILES}/${id}/download`);
}

async function responseText(response: Response): Promise<string> {
  return new TextDecoder().decode(await response.arrayBuffer());
}

async function uploadedFile(name: string, parentId?: string) {
  const response = await uploadFile(name, "image", parentId, "image/png");
  expect(response.status).toBe(HTTP_STATUS.CREATED);
  return ((await response.json()) as { file: { id: string } }).file;
}
