import { UI_LOCALE } from "@client/content/ko/shared/format";
import {
  KOREA_DATE_TIME_FORMAT_OPTIONS,
  KOREA_TIME_FORMAT_OPTIONS,
} from "@client/content/ko/shared/korea-clock";
import { useEffect, useMemo, useState } from "react";
import { KOREA_CLOCK_REFRESH_MILLISECONDS } from "@client/constants/shared/korea-clock";
import type { KoreaClock } from "@client/types/shared/korea-clock";

export function useKoreaClock(): KoreaClock {
  const [now, setNow] = useState(() => new Date());
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(UI_LOCALE, KOREA_TIME_FORMAT_OPTIONS),
    [],
  );
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(UI_LOCALE, KOREA_DATE_TIME_FORMAT_OPTIONS),
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(new Date()),
      KOREA_CLOCK_REFRESH_MILLISECONDS,
    );
    return () => window.clearInterval(interval);
  }, []);

  return {
    time: timeFormatter.format(now),
    dateTime: dateTimeFormatter.format(now),
  };
}
