import { STORAGE_MIME_CATEGORY } from "@/constants/storage/storage-status";

export const STORAGE_MIME_CATEGORY_COLOR = {
  [STORAGE_MIME_CATEGORY.IMAGE]: "#3b78d8",
  [STORAGE_MIME_CATEGORY.VIDEO]: "#7456b8",
  [STORAGE_MIME_CATEGORY.AUDIO]: "#2e9b62",
  [STORAGE_MIME_CATEGORY.DOCUMENT]: "#d39a28",
  [STORAGE_MIME_CATEGORY.ARCHIVE]: "#b65a36",
  [STORAGE_MIME_CATEGORY.OTHER]: "#7b8794",
} as const;

export const STORAGE_USAGE_LEVEL = {
  NORMAL: "normal",
  WARNING: "warning",
  EXCEEDED: "exceeded",
} as const;

export const STORAGE_STATUS_CLASS_NAME = {
  ROOT: "storage-status-widget",
  SUMMARY: "storage-status-widget__summary",
  PANEL: "storage-status-widget__panel",
  METER: "storage-status-widget__meter",
  METER_LABEL: "storage-status-widget__meter-label",
  METER_TRACK: "storage-status-widget__meter-track",
  METER_FILL: "storage-status-widget__meter-fill",
  GRAPH: "storage-status-widget__graph",
  GRAPH_SEGMENT: "storage-status-widget__graph-segment",
  LEGEND: "storage-status-widget__legend",
  COUNTS: "storage-status-widget__counts",
  NOTE: "storage-status-widget__note",
  TIMESTAMP: "storage-status-widget__timestamp",
} as const;

export const STORAGE_STATUS_STYLE_PROPERTY = {
  SEGMENT_COLOR: "--storage-segment-color",
} as const;
