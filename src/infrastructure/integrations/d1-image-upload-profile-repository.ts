import type {
  ImageUploadContentType,
  ImageUploadProfileRepository,
  ImageUploadProfileRootId,
  StoredImageUploadProfile,
} from "@/types/integrations/image-upload-profile";

interface ImageUploadProfileRow {
  readonly id: string;
  readonly display_name: string;
  readonly root_id: string;
  readonly path_template: string;
  readonly file_name_template: string;
  readonly enabled: number;
  readonly created_at: number;
  readonly updated_at: number;
  readonly content_type: string | null;
}

const PROFILE_SELECT = `
  SELECT p.id, p.display_name, p.root_id, p.path_template,
         p.file_name_template, p.enabled, p.created_at, p.updated_at,
         c.content_type
  FROM integration_image_profiles p
  LEFT JOIN integration_image_profile_content_types c
    ON c.profile_id = p.id`;

export class D1ImageUploadProfileRepository
  implements ImageUploadProfileRepository
{
  constructor(private readonly database: D1Database) {}

  async list(): Promise<StoredImageUploadProfile[]> {
    const result = await this.database
      .prepare(`${PROFILE_SELECT} ORDER BY p.created_at ASC, p.id ASC, c.content_type ASC`)
      .all<ImageUploadProfileRow>();
    return groupProfileRows(result.results);
  }

  async find(id: string): Promise<StoredImageUploadProfile | null> {
    const result = await this.database
      .prepare(`${PROFILE_SELECT} WHERE p.id = ?1 ORDER BY c.content_type ASC`)
      .bind(id)
      .all<ImageUploadProfileRow>();
    return groupProfileRows(result.results)[0] ?? null;
  }

  async insert(profile: StoredImageUploadProfile): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT OR IGNORE INTO integration_image_profiles (
           id, display_name, root_id, path_template, file_name_template,
           enabled, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(...profileBindings(profile))
      .run();
    if (result.meta.changes === 0) return false;

    try {
      await this.database.batch(contentTypeStatements(this.database, profile));
      return true;
    } catch (error) {
      await this.database
        .prepare("DELETE FROM integration_image_profiles WHERE id = ?1")
        .bind(profile.id)
        .run();
      throw error;
    }
  }

  async replace(profile: StoredImageUploadProfile): Promise<boolean> {
    const statements = [
      this.database
        .prepare(
          `UPDATE integration_image_profiles SET
             display_name = ?2, root_id = ?3, path_template = ?4,
             file_name_template = ?5, enabled = ?6, updated_at = ?8
           WHERE id = ?1`,
        )
        .bind(...profileBindings(profile)),
      this.database
        .prepare(
          "DELETE FROM integration_image_profile_content_types WHERE profile_id = ?1",
        )
        .bind(profile.id),
      ...profile.contentTypes.map((contentType) =>
        this.database
          .prepare(
            `INSERT INTO integration_image_profile_content_types (profile_id, content_type)
             SELECT ?1, ?2 WHERE EXISTS (
               SELECT 1 FROM integration_image_profiles WHERE id = ?1
             )`,
          )
          .bind(profile.id, contentType),
      ),
    ];
    const results = await this.database.batch(statements);
    return (results[0]?.meta.changes ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database
      .prepare("DELETE FROM integration_image_profiles WHERE id = ?1")
      .bind(id)
      .run();
    return result.meta.changes > 0;
  }
}

function profileBindings(profile: StoredImageUploadProfile) {
  return [
    profile.id,
    profile.displayName,
    profile.rootId,
    profile.pathTemplate,
    profile.fileNameTemplate,
    profile.enabled ? 1 : 0,
    profile.createdAt,
    profile.updatedAt,
  ] as const;
}

function contentTypeStatements(
  database: D1Database,
  profile: StoredImageUploadProfile,
): D1PreparedStatement[] {
  return profile.contentTypes.map((contentType) =>
    database
      .prepare(
        `INSERT INTO integration_image_profile_content_types (profile_id, content_type)
         VALUES (?1, ?2)`,
      )
      .bind(profile.id, contentType),
  );
}

function groupProfileRows(
  rows: readonly ImageUploadProfileRow[],
): StoredImageUploadProfile[] {
  const profiles = new Map<string, StoredImageUploadProfile>();
  for (const row of rows) {
    const existing = profiles.get(row.id);
    const contentTypes = [
      ...(existing?.contentTypes ?? []),
      ...(row.content_type ? [row.content_type as ImageUploadContentType] : []),
    ];
    profiles.set(row.id, {
      id: row.id,
      displayName: row.display_name,
      rootId: row.root_id as ImageUploadProfileRootId,
      pathTemplate: row.path_template,
      fileNameTemplate: row.file_name_template,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      contentTypes,
    });
  }
  return [...profiles.values()];
}
