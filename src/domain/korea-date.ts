import {
  KOREA_UTC_OFFSET_MILLISECONDS,
  MILLISECONDS_PER_DAY,
} from "../constants/date";

export interface KoreaDateContext {
  readonly businessDate: string;
  readonly nextResetAt: number;
}

export function getKoreaDateContext(timestamp: number): KoreaDateContext {
  const koreaTimestamp = timestamp + KOREA_UTC_OFFSET_MILLISECONDS;
  const nextKoreaDay =
    (Math.floor(koreaTimestamp / MILLISECONDS_PER_DAY) + 1) *
    MILLISECONDS_PER_DAY;

  return {
    businessDate: new Date(koreaTimestamp).toISOString().slice(0, 10),
    nextResetAt: nextKoreaDay - KOREA_UTC_OFFSET_MILLISECONDS,
  };
}
