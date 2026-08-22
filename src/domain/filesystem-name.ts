import { FILESYSTEM_COPY_INDEX_START } from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { MAX_FILE_NAME_BYTES } from "../constants/file";
import { AppError } from "./errors";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const PATH_SEPARATOR = /[\\/]/;

export function normalizeFilesystemName(input: string): string {
  const name = input.normalize("NFC").trim();
  if (
    !name ||
    name === "." ||
    name === ".." ||
    CONTROL_CHARACTER.test(name) ||
    PATH_SEPARATOR.test(name)
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_ENTRY_NAME);
  }
  if (new TextEncoder().encode(name).byteLength > MAX_FILE_NAME_BYTES) {
    throw new AppError(FILESYSTEM_ERRORS.ENTRY_NAME_TOO_LONG);
  }
  return name;
}

export function filesystemNameKey(name: string): string {
  return name.normalize("NFC").toLocaleLowerCase("ko-KR");
}

export function availableFilesystemName(
  requestedName: string,
  occupiedNameKeys: ReadonlySet<string>,
): string {
  if (!occupiedNameKeys.has(filesystemNameKey(requestedName))) {
    return requestedName;
  }

  const { base, extension } = splitExtension(requestedName);
  for (let index = FILESYSTEM_COPY_INDEX_START; ; index += 1) {
    const candidate = numberedFilesystemName(base, extension, index);
    if (!occupiedNameKeys.has(filesystemNameKey(candidate))) {
      return candidate;
    }
  }
}

function numberedFilesystemName(
  base: string,
  extension: string,
  index: number,
): string {
  const suffix = ` (${index})`;
  const availableNameBytes = MAX_FILE_NAME_BYTES - utf8Length(suffix);
  const minimumBase = [...base][0] ?? "";
  const minimumBaseBytes = utf8Length(minimumBase);
  const fittedExtension = truncateUtf8(
    extension,
    Math.max(0, availableNameBytes - minimumBaseBytes),
  );
  const fittedBase = truncateUtf8(
    base,
    Math.max(
      minimumBaseBytes,
      availableNameBytes - utf8Length(fittedExtension),
    ),
  );
  return `${fittedBase}${suffix}${fittedExtension}`;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  let result = "";
  let size = 0;
  for (const character of value) {
    const characterSize = utf8Length(character);
    if (size + characterSize > maximumBytes) break;
    result += character;
    size += characterSize;
  }
  return result;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function splitExtension(name: string): { base: string; extension: string } {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { base: name, extension: "" };
  }
  return { base: name.slice(0, dotIndex), extension: name.slice(dotIndex) };
}
