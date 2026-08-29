import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { FILE_SIZE_DISPLAY } from "@client/constants/filesystem/filesystem";

export function formatFileSize(size: number): string {
  if (size < FILE_SIZE_DISPLAY.KILOBYTE_BYTES) {
    return `${size} ${FILESYSTEM_COPY.BYTE_UNIT}`;
  }
  if (size < FILE_SIZE_DISPLAY.MEGABYTE_BYTES) {
    return `${(size / FILE_SIZE_DISPLAY.KILOBYTE_BYTES).toFixed(
      FILE_SIZE_DISPLAY.FRACTION_DIGITS,
    )} ${FILESYSTEM_COPY.KILOBYTE_UNIT}`;
  }
  if (size < FILE_SIZE_DISPLAY.GIGABYTE_BYTES) {
    return `${(size / FILE_SIZE_DISPLAY.MEGABYTE_BYTES).toFixed(
      FILE_SIZE_DISPLAY.FRACTION_DIGITS,
    )} ${FILESYSTEM_COPY.MEGABYTE_UNIT}`;
  }
  if (size < FILE_SIZE_DISPLAY.TERABYTE_BYTES) {
    return `${(size / FILE_SIZE_DISPLAY.GIGABYTE_BYTES).toFixed(
      FILE_SIZE_DISPLAY.FRACTION_DIGITS,
    )} ${FILESYSTEM_COPY.GIGABYTE_UNIT}`;
  }
  return `${(size / FILE_SIZE_DISPLAY.TERABYTE_BYTES).toFixed(
    FILE_SIZE_DISPLAY.FRACTION_DIGITS,
  )} ${FILESYSTEM_COPY.TERABYTE_UNIT}`;
}
