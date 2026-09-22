import type { CreateFilesystemShortcutInput, FilesystemShortcutEntry, FilesystemShortcutTarget } from "@/types/filesystem/filesystem";

export interface FilesystemShortcutUseCases {
  createShortcut(input: CreateFilesystemShortcutInput): Promise<FilesystemShortcutEntry>;
  resolveShortcut(id: string): Promise<FilesystemShortcutTarget>;
}
