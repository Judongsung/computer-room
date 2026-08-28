import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ImageUploadProfile,
  ImageUploadProfileConfigurationInput,
} from "@/types/integrations/image-upload-profile";
import {
  EMPTY_IMAGE_UPLOAD_PROFILE_DRAFT,
  IMAGE_UPLOAD_PROFILE_COPY,
} from "@client/constants/integrations/image-upload-profile";
import { messageFromError } from "@client/errors/error-message";
import type {
  ImageUploadProfileDraft,
  ImageUploadProfileGateway,
} from "@client/types/integrations/image-upload-profile";

export function useImageUploadProfiles(
  gateway: ImageUploadProfileGateway,
) {
  const [profiles, setProfiles] = useState<readonly ImageUploadProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImageUploadProfileDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await gateway.listProfiles();
      setProfiles(loaded);
      const selected = loaded.find(
        (profile) => profile.id === selectedIdRef.current,
      );
      const next = selected ?? loaded[0] ?? null;
      selectedIdRef.current = next?.id ?? null;
      setSelectedId(selectedIdRef.current);
      setCreating(false);
      setDraft(next ? toDraft(next) : null);
    } catch (caught) {
      setError(messageFromError(caught, IMAGE_UPLOAD_PROFILE_COPY.LOAD_FAILED));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const select = useCallback((profile: ImageUploadProfile): void => {
    selectedIdRef.current = profile.id;
    setSelectedId(profile.id);
    setCreating(false);
    setDraft(toDraft(profile));
    setError(null);
  }, []);

  const beginCreate = useCallback((): void => {
    selectedIdRef.current = null;
    setSelectedId(null);
    setCreating(true);
    setDraft(cloneEmptyDraft());
    setError(null);
  }, []);

  const changeDraft = useCallback(
    (change: Partial<ImageUploadProfileDraft>): void => {
      setDraft((current) => (current ? { ...current, ...change } : current));
    },
    [],
  );

  const save = useCallback(async (): Promise<ImageUploadProfile | null> => {
    if (!draft || busy) return null;
    setBusy(true);
    setError(null);
    try {
      const configuration = toConfiguration(draft);
      const saved = creating
        ? await gateway.createProfile({ id: draft.id, ...configuration })
        : await gateway.updateProfile(draft.id, configuration);
      setProfiles((current) => upsertProfile(current, saved));
      selectedIdRef.current = saved.id;
      setSelectedId(saved.id);
      setCreating(false);
      setDraft(toDraft(saved));
      return saved;
    } catch (caught) {
      setError(messageFromError(caught, IMAGE_UPLOAD_PROFILE_COPY.SAVE_FAILED));
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, creating, draft, gateway]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!selectedId || busy || creating) return false;
    setBusy(true);
    setError(null);
    try {
      await gateway.deleteProfile(selectedId);
      const remaining = profiles.filter((profile) => profile.id !== selectedId);
      const next = remaining[0] ?? null;
      setProfiles(remaining);
      selectedIdRef.current = next?.id ?? null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? toDraft(next) : null);
      return true;
    } catch (caught) {
      setError(messageFromError(caught, IMAGE_UPLOAD_PROFILE_COPY.DELETE_FAILED));
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, creating, gateway, profiles, selectedId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  return {
    profiles,
    selectedProfile,
    draft,
    creating,
    loading,
    busy,
    error,
    load,
    select,
    beginCreate,
    changeDraft,
    save,
    remove,
  } as const;
}

function toDraft(profile: ImageUploadProfile): ImageUploadProfileDraft {
  return {
    id: profile.id,
    displayName: profile.displayName,
    rootId: profile.rootId,
    pathTemplate: profile.pathTemplate,
    fileNameTemplate: profile.fileNameTemplate,
    enabled: profile.enabled,
    contentTypes: [...profile.contentTypes],
  };
}

function cloneEmptyDraft(): ImageUploadProfileDraft {
  return {
    ...EMPTY_IMAGE_UPLOAD_PROFILE_DRAFT,
    contentTypes: [...EMPTY_IMAGE_UPLOAD_PROFILE_DRAFT.contentTypes],
  };
}

function toConfiguration(
  draft: ImageUploadProfileDraft,
): ImageUploadProfileConfigurationInput {
  return {
    displayName: draft.displayName,
    rootId: draft.rootId,
    pathTemplate: draft.pathTemplate,
    fileNameTemplate: draft.fileNameTemplate,
    enabled: draft.enabled,
    contentTypes: draft.contentTypes,
  };
}

function upsertProfile(
  profiles: readonly ImageUploadProfile[],
  saved: ImageUploadProfile,
): readonly ImageUploadProfile[] {
  const existingIndex = profiles.findIndex((profile) => profile.id === saved.id);
  if (existingIndex < 0) return [...profiles, saved];
  return profiles.map((profile) => (profile.id === saved.id ? saved : profile));
}
