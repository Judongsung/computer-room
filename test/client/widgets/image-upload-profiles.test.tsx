import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
} from "@/constants/integrations/image-upload-profile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type {
  CreateImageUploadProfileInput,
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
} from "@/types/integrations/image-upload-profile";
import { ImageUploadProfilesWidget } from "@client/components/widgets/image-upload-profiles-widget";
import { IMAGE_UPLOAD_PROFILE_COPY } from "@client/constants/integrations/image-upload-profile";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";

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
    expect(screen.getByText(/바탕 화면\\NovelAI\\2026-08-28/)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(IMAGE_UPLOAD_PROFILE_COPY.DISPLAY_NAME);
    await user.clear(nameInput);
    await user.type(nameInput, "NovelAI 자동 저장");
    await user.click(screen.getByRole("button", { name: IMAGE_UPLOAD_PROFILE_COPY.SAVE }));

    await waitFor(() => expect(gateway.updateProfile).toHaveBeenCalledOnce());
    expect(gateway.updateProfile).toHaveBeenCalledWith(
      "novelai",
      expect.objectContaining({ displayName: "NovelAI 자동 저장" }),
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
});

function renderWidget(gateway: ImageUploadProfileGateway): void {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.IMAGE_UPLOAD_PROFILES];
  render(
    <ImageUploadProfilesWidget
      widget={{
        id: "image-upload-profiles-widget",
        type: WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
        position: { x: 32, y: 32 },
        size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
        stackOrder: 0,
        file: null,
        data: null,
      }}
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
      gateway={{} as never}
      storageStatusGateway={{} as never}
      imageUploadProfileGateway={gateway}
      onWidgetChange={vi.fn()}
    />,
  );
}

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
