import { describe, expect, it } from "vitest";
import { ImageUploadProfileService } from "@/application/integrations/image-upload-profile-service";
import { IMAGE_UPLOAD_CONTENT_TYPE } from "@/constants/integrations/image-upload-profile";
import { IMAGE_UPLOAD_PROFILE_ERRORS } from "@/constants/integrations/errors/image-upload-profile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type {
  ImageUploadProfileRepository,
  StoredImageUploadProfile,
} from "@/types/integrations/image-upload-profile";
import { StaticClock } from "@test/support/platform/runtime-fakes";

const NOW = Date.parse("2026-08-28T01:23:45.000Z");
const INPUT = {
  id: "capture",
  displayName: "Capture",
  rootId: FILESYSTEM_ROOT_ID.DESKTOP,
  pathTemplate: "Capture/{yyyy-MM-dd}",
  fileNameTemplate: "{uuid}.{ext}",
  enabled: true,
  contentTypes: [IMAGE_UPLOAD_CONTENT_TYPE.PNG],
} as const;

describe("ImageUploadProfileService", () => {
  it("creates, replaces, lists, disables, and deletes a profile", async () => {
    const repository = new MemoryImageUploadProfileRepository();
    const service = new ImageUploadProfileService(
      repository,
      new StaticClock(NOW),
    );

    const created = await service.createProfile(INPUT);
    expect(created).toMatchObject({
      id: INPUT.id,
      displayName: INPUT.displayName,
      createdAt: new Date(NOW).toISOString(),
    });
    await expect(service.listProfiles()).resolves.toEqual([created]);

    const updated = await service.updateProfile(INPUT.id, {
      ...INPUT,
      displayName: "Changed",
      enabled: false,
    });
    expect(updated).toMatchObject({ displayName: "Changed", enabled: false });
    await expect(service.requireEnabledProfile(INPUT.id)).rejects.toMatchObject({
      code: IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND.code,
    });

    await service.deleteProfile(INPUT.id);
    await expect(service.listProfiles()).resolves.toEqual([]);
  });

  it("rejects duplicate creation and missing updates", async () => {
    const repository = new MemoryImageUploadProfileRepository();
    const service = new ImageUploadProfileService(
      repository,
      new StaticClock(NOW),
    );
    await service.createProfile(INPUT);

    await expect(service.createProfile(INPUT)).rejects.toMatchObject({
      code: IMAGE_UPLOAD_PROFILE_ERRORS.ID_ALREADY_EXISTS.code,
    });
    await expect(
      service.updateProfile("missing", INPUT),
    ).rejects.toMatchObject({ code: IMAGE_UPLOAD_PROFILE_ERRORS.NOT_FOUND.code });
  });
});

class MemoryImageUploadProfileRepository
  implements ImageUploadProfileRepository
{
  private readonly records = new Map<string, StoredImageUploadProfile>();

  async list(): Promise<StoredImageUploadProfile[]> {
    return [...this.records.values()].map((profile) => structuredClone(profile));
  }

  async find(id: string): Promise<StoredImageUploadProfile | null> {
    const profile = this.records.get(id);
    return profile ? structuredClone(profile) : null;
  }

  async insert(profile: StoredImageUploadProfile): Promise<boolean> {
    if (this.records.has(profile.id)) return false;
    this.records.set(profile.id, structuredClone(profile));
    return true;
  }

  async replace(profile: StoredImageUploadProfile): Promise<boolean> {
    if (!this.records.has(profile.id)) return false;
    this.records.set(profile.id, structuredClone(profile));
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}
