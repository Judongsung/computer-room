import { useEffect, useMemo, useState } from "react";
import { KOREA_LOCALE } from "@/constants/platform/date";
import {
  DESKTOP_CLOCK_REFRESH_MILLISECONDS,
  KOREA_DATE_TIME_FORMAT_OPTIONS,
  KOREA_TIME_FORMAT_OPTIONS,
} from "@client/constants/desktop/desktop";
import type { KoreaClock } from "@client/types/desktop/desktop";

export function useKoreaClock(): KoreaClock {
  const [now, setNow] = useState(() => new Date());
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(KOREA_LOCALE, KOREA_TIME_FORMAT_OPTIONS),
    [],
  );
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(KOREA_LOCALE, KOREA_DATE_TIME_FORMAT_OPTIONS),
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(new Date()),
      DESKTOP_CLOCK_REFRESH_MILLISECONDS,
    );
    return () => window.clearInterval(interval);
  }, []);

  return {
    time: timeFormatter.format(now),
    dateTime: dateTimeFormatter.format(now),
  };
}
