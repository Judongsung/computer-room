import {
  STORAGE_USAGE_LIMIT_PERCENT,
  STORAGE_USAGE_WARNING_PERCENT,
} from "../../constants/storage-status";
import { STORAGE_USAGE_LEVEL } from "../constants/storage-status";

export function storageUsagePercent(bytes: number, referenceBytes: number): number {
  if (referenceBytes <= 0) return 0;
  return (bytes / referenceBytes) * STORAGE_USAGE_LIMIT_PERCENT;
}

export function storageUsageLevel(percent: number) {
  if (percent >= STORAGE_USAGE_LIMIT_PERCENT) {
    return STORAGE_USAGE_LEVEL.EXCEEDED;
  }
  if (percent >= STORAGE_USAGE_WARNING_PERCENT) {
    return STORAGE_USAGE_LEVEL.WARNING;
  }
  return STORAGE_USAGE_LEVEL.NORMAL;
}

export function storageGraphPercent(bytes: number, totalBytes: number): number {
  return totalBytes <= 0 ? 0 : (bytes / totalBytes) * 100;
}
