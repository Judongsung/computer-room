import {
  IMAGE_UPLOAD_CONTENT_TYPE_LABEL,
  IMAGE_UPLOAD_PROFILE_COPY,
} from "@client/content/ko/integrations/image-upload-profile";
import { IMAGE_UPLOAD_LOG_COPY } from "@client/content/ko/integrations/image-upload-log";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
} from "@/constants/integrations/image-upload-profile";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";

import type {
  CreateImageUploadProfileInput,
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
} from "@/types/integrations/image-upload-profile";
import { ImageUploadProfilesWidget } from "@client/components/widgets/image-upload-profiles-widget";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";

const NOVELAI_PROFILE: ImageUploadProfile = {
  id: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ID,
  displayName: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.DISPLAY_NAME,
  rootId: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.ROOT_ID,
  pathTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.PATH_TEMPLATE,
  fileNameTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.FILE_NAME_TEMPLATE,
  enabled: true,
  contentTypes: [...IMAGE_UPLOAD_CONTENT_TYPE_VALUES],
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

describe("image upload profiles widget", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("loads, previews, updates, and copies a profile URL", async () => {
    const gateway = fakeGateway([NOVELAI_PROFILE]);
    const user = userEvent.setup();
    renderWidget(gateway);

    expect(await screen.findByDisplayValue("NovelAI")).toBeInTheDocument();
    expect(document.querySelector(".xp-window-frame__toolbar")).toBeNull();
    expect(
      screen.getByRole("group", {
        name: IMAGE_UPLOAD_PROFILE_COPY.CONTENT_TYPES,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: IMAGE_UPLOAD_PROFILE_COPY.PREVIEW }),
    ).toBeInTheDocument();
    const jpegCheckbox = screen.getByRole("checkbox", {
      name: IMAGE_UPLOAD_CONTENT_TYPE_LABEL["image/jpeg"],
    });
    const enabledCheckbox = screen.getByRole("checkbox", {
      name: IMAGE_UPLOAD_PROFILE_COPY.ENABLED,
    });
    expect(jpegCheckbox.nextElementSibling).toHaveAttribute(
      "for",
      jpegCheckbox.id,
    );
    expect(enabledCheckbox.nextElementSibling).toHaveAttribute(
      "for",
      enabledCheckbox.id,
    );
    await user.click(jpegCheckbox);
    expect(screen.getByText(/바탕 화면\\NovelAI\\2026-08-28/)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(IMAGE_UPLOAD_PROFILE_COPY.DISPLAY_NAME);
    await user.clear(nameInput);
    await user.type(nameInput, "NovelAI 자동 저장");
    await user.click(screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.SAVE }));

    await waitFor(() => expect(gateway.updateProfile).toHaveBeenCalledOnce());
    expect(gateway.updateProfile).toHaveBeenCalledWith(
      "novelai",
      expect.objectContaining({
        displayName: "NovelAI 자동 저장",
        contentTypes: expect.not.arrayContaining(["image/jpeg"]),
      }),
    );

    await user.click(
      screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.COPY_URL }),
    );
    expect(screen.getByText(/\/api\/integrations\/novelai\/images$/)).toBeInTheDocument();
    expect(
      screen.getByText(IMAGE_UPLOAD_PROFILE_COPY.COPY_COMPLETE),
    ).toBeInTheDocument();
  });

  it("creates and deletes a profile without exposing authentication settings", async () => {
    const gateway = fakeGateway([NOVELAI_PROFILE]);
    const user = userEvent.setup();
    renderWidget(gateway);
    await screen.findByDisplayValue("NovelAI");

    await user.click(
      screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.NEW_PROFILE }),
    );
    await user.type(screen.getByLabelText(/프로필 ID/), "camera");
    await user.type(
      screen.getByLabelText(IMAGE_UPLOAD_PROFILE_COPY.DISPLAY_NAME),
      "Camera",
    );
    await user.click(screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.SAVE }));
    await waitFor(() => expect(gateway.createProfile).toHaveBeenCalledOnce());

    expect(screen.queryByText(/token|audience|secret/i)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.DELETE }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "기존 파일과 폴더는 유지",
    );
    await user.click(
      screen.getByRole("button", {
        name: IMAGE_UPLOAD_PROFILE_COPY.DELETE_CONFIRM,
      }),
    );
    await waitFor(() => expect(gateway.deleteProfile).toHaveBeenCalledWith("camera"));
  });

  it("loads receive logs from a reusable tab and opens an available file", async () => {
    const gateway = fakeGateway([NOVELAI_PROFILE]);
    const file = {
      id: "saved-file",
      parentId: "date-directory",
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: "saved.png",
      contentType: "image/png",
      size: 128,
      createdAt: "2026-08-29T15:00:00.000Z",
      updatedAt: "2026-08-29T15:00:00.000Z",
      desktopOrder: null,
    } as const;
    const logGateway: ImageUploadLogGateway = {
      listImageUploadLogs: vi.fn(async () => ({
        items: [
          {
            id: "log",
            profileId: "novelai",
            sourceIp: "203.0.113.8",
            outcome: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
            contentType: "image/png",
            declaredSize: file.size,
            fileName: file.name,
            file,
            httpStatus: 201,
            error: null,
            receivedAt: "2026-08-29T15:00:00.000Z",
            durationMs: 23,
          },
        ],
        nextCursor: null,
      })),
      getImageUploadLogSettings: vi.fn(async () => ({ retentionDays: 30 })),
      updateImageUploadLogRetentionDays: vi.fn(async (retentionDays) => ({
        retentionDays,
      })),
    };
    const openFile = vi.fn();
    const user = userEvent.setup();
    renderWidget(gateway, logGateway, openFile);

    await user.click(
      screen.getByRole("tab", { name: IMAGE_UPLOAD_LOG_COPY.LOGS_TAB }),
    );
    const fileButton = await screen.findByRole("button", { name: file.name });
    expect(logGateway.listImageUploadLogs).toHaveBeenCalledWith({});
    expect(logGateway.getImageUploadLogSettings).toHaveBeenCalledOnce();
    expect(
      screen.getByText(IMAGE_UPLOAD_LOG_COPY.RETENTION_NOTICE(30)),
    ).toBeInTheDocument();
    expect(screen.getByText("203.0.113.8")).toBeInTheDocument();
    await user.click(fileButton);
    expect(openFile).toHaveBeenCalledWith(file);

    const retentionInput = screen.getByRole("spinbutton", {
      name: IMAGE_UPLOAD_LOG_COPY.RETENTION_DAYS,
    });
    await user.clear(retentionInput);
    await user.type(retentionInput, "90");
    await user.click(
      screen.getByRole("button", { name: IMAGE_UPLOAD_LOG_COPY.SAVE_SETTINGS }),
    );
    await waitFor(() =>
      expect(logGateway.updateImageUploadLogRetentionDays).toHaveBeenCalledWith(
        90,
      ),
    );

    await user.click(
      screen.getByRole("tab", { name: IMAGE_UPLOAD_LOG_COPY.PROFILES_TAB }),
    );
    await user.click(
      screen.getByRole("tab", { name: IMAGE_UPLOAD_LOG_COPY.LOGS_TAB }),
    );
    await waitFor(() =>
      expect(logGateway.listImageUploadLogs).toHaveBeenCalledTimes(3),
    );
  });

  it("validates retention days before sending a settings update", async () => {
    const updateRetentionDays = vi.fn(async (retentionDays: number) => ({
      retentionDays,
    }));
    const logGateway: ImageUploadLogGateway = {
      listImageUploadLogs: vi.fn(async () => ({ items: [], nextCursor: null })),
      getImageUploadLogSettings: vi.fn(async () => ({ retentionDays: 30 })),
      updateImageUploadLogRetentionDays: updateRetentionDays,
    };
    const user = userEvent.setup();
    renderWidget(fakeGateway([NOVELAI_PROFILE]), logGateway);

    await user.click(
      screen.getByRole("tab", { name: IMAGE_UPLOAD_LOG_COPY.LOGS_TAB }),
    );
    const input = await screen.findByRole("spinbutton", {
      name: IMAGE_UPLOAD_LOG_COPY.RETENTION_DAYS,
    });
    await user.clear(input);
    await user.type(input, "0");
    await user.click(
      screen.getByRole("button", { name: IMAGE_UPLOAD_LOG_COPY.SAVE_SETTINGS }),
    );

    expect(updateRetentionDays).not.toHaveBeenCalled();
    expect(
      screen.getByText(IMAGE_UPLOAD_LOG_COPY.INVALID_RETENTION_DAYS),
    ).toBeInTheDocument();
  });
});

function renderWidget(
  gateway: ImageUploadProfileGateway,
  logGateway: ImageUploadLogGateway = EMPTY_LOG_GATEWAY,
  onOpenFilesystemEntry = vi.fn(),
): void {
  render(
    <ImageUploadProfilesWidget
      windowControls={{
        isActive: true,
        isMaximized: false,
        onFocus: vi.fn(),
        onMinimize: vi.fn(),
        onToggleMaximize: vi.fn(),
        onClose: vi.fn(),
        onSaveFile: vi.fn(),
        canSaveFile: false,
      }}
      imageUploadProfileGateway={gateway}
      imageUploadLogGateway={logGateway}
      onOpenFilesystemEntry={onOpenFilesystemEntry}
    />,
  );
}

const EMPTY_LOG_GATEWAY: ImageUploadLogGateway = {
  listImageUploadLogs: vi.fn(async () => ({ items: [], nextCursor: null })),
  getImageUploadLogSettings: vi.fn(async () => ({ retentionDays: 30 })),
  updateImageUploadLogRetentionDays: vi.fn(async (retentionDays) => ({
    retentionDays,
  })),
};

function fakeGateway(initial: readonly ImageUploadProfile[]) {
  let profiles = [...initial];
  const gateway = {
    listProfiles: vi.fn(async () => profiles),
    createProfile: vi.fn(async (input: CreateImageUploadProfileInput) => {
      const profile = publicProfile(input);
      profiles = [...profiles, profile];
      return profile;
    }),
    updateProfile: vi.fn(
      async (id: string, input: ImageUploadProfileConfigurationInput) => {
        const existing = profiles.find((profile) => profile.id === id);
        if (!existing) throw new Error("Profile not found");
        const profile: ImageUploadProfile = {
          ...existing,
          ...validatedConfiguration(input),
          updatedAt: "2026-08-29T00:00:00.000Z",
        };
        profiles = profiles.map((candidate) =>
          candidate.id === id ? profile : candidate,
        );
        return profile;
      },
    ),
    deleteProfile: vi.fn(async (id: string) => {
      profiles = profiles.filter((profile) => profile.id !== id);
    }),
  } satisfies ImageUploadProfileGateway;
  return gateway;
}

function publicProfile(input: CreateImageUploadProfileInput): ImageUploadProfile {
  return {
    id: input.id,
    ...validatedConfiguration(input),
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

function validatedConfiguration(
  input: ImageUploadProfileConfigurationInput,
): Omit<ImageUploadProfile, "id" | "createdAt" | "updatedAt"> {
  return {
    displayName: input.displayName,
    rootId:
      input.rootId === FILESYSTEM_ROOT_ID.DOCUMENTS
        ? FILESYSTEM_ROOT_ID.DOCUMENTS
        : FILESYSTEM_ROOT_ID.DESKTOP,
    pathTemplate: input.pathTemplate,
    fileNameTemplate: input.fileNameTemplate,
    enabled: input.enabled,
    contentTypes: input.contentTypes.filter((contentType) =>
      IMAGE_UPLOAD_CONTENT_TYPE_VALUES.some(
        (supported) => supported === contentType,
      ),
    ) as ImageUploadProfile["contentTypes"],
  };
}
