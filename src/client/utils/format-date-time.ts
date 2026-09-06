import { KOREA_UTC_OFFSET_MILLISECONDS } from "@/constants/platform/date";

export function formatKoreaDateTime(value: string): string {
  const date = new Date(Date.parse(value) + KOREA_UTC_OFFSET_MILLISECONDS);
  return date.toISOString().slice(0, 16).replace("T", " ");
}
