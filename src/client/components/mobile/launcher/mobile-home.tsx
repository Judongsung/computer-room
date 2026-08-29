import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useMemo, useRef, useState, type CSSProperties, type UIEvent } from "react";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import {
  MOBILE_ASSET_PATHS,
} from "@client/constants/mobile/assets";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import {
  MOBILE_CSS_VARIABLE,
  MOBILE_SYSTEM_ITEM_ID,
} from "@client/constants/mobile/launcher";
import { MOBILE_LAYOUT } from "@client/constants/mobile/layout";
import { useElementSize } from "@client/hooks/shared/use-element-size";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileHomeProps {
  readonly entries: readonly FilesystemEntry[];
  readonly error: string | null;
  readonly gateway: FilesystemGateway;
  readonly onOpenDocuments: () => void;
  readonly onOpenComputer: () => void;
  readonly onOpenTrash: () => void;
  readonly onOpenEntry: (entry: FilesystemEntry) => void;
  readonly wallpaperUrl: string | null;
}

type HomeItem =
  | {
      readonly id: string;
      readonly name: string;
      readonly iconPath: string;
      readonly onOpen: () => void;
    }
  | { readonly id: string; readonly name: string; readonly entry: FilesystemEntry };

export function MobileHome({
  entries,
  error,
  gateway,
  onOpenDocuments,
  onOpenComputer,
  onOpenTrash,
  onOpenEntry,
  wallpaperUrl,
}: MobileHomeProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(pagesRef);
  const [currentPage, setCurrentPage] = useState(0);
  const columns = Math.max(
    1,
    size.width > 0
      ? Math.floor(size.width / MOBILE_LAYOUT.HOME_ICON_CELL_WIDTH_PX)
      : MOBILE_LAYOUT.HOME_FALLBACK_COLUMNS,
  );
  const rows = Math.max(
    1,
    size.height > 0
      ? Math.floor(size.height / MOBILE_LAYOUT.HOME_ICON_CELL_HEIGHT_PX)
      : MOBILE_LAYOUT.HOME_FALLBACK_ROWS,
  );
  const items = useMemo<readonly HomeItem[]>(
    () => [
      {
        id: MOBILE_SYSTEM_ITEM_ID.DOCUMENTS,
        name: MOBILE_COPY.MY_DOCUMENTS,
        iconPath: MOBILE_ASSET_PATHS.DOCUMENTS,
        onOpen: onOpenDocuments,
      },
      {
        id: MOBILE_SYSTEM_ITEM_ID.COMPUTER,
        name: MOBILE_COPY.MY_COMPUTER,
        iconPath: MOBILE_ASSET_PATHS.COMPUTER,
        onOpen: onOpenComputer,
      },
      {
        id: MOBILE_SYSTEM_ITEM_ID.RECYCLE_BIN,
        name: MOBILE_COPY.RECYCLE_BIN,
        iconPath: MOBILE_ASSET_PATHS.RECYCLE_BIN,
        onOpen: onOpenTrash,
      },
      ...entries.map((entry) => ({ id: entry.id, name: entry.name, entry })),
    ],
    [entries, onOpenComputer, onOpenDocuments, onOpenTrash],
  );
  const pages = chunk(items, columns * rows);
  const pageStyle = {
    gridTemplateColumns: `repeat(${columns}, ${MOBILE_LAYOUT.HOME_ICON_CELL_WIDTH_PX}px)`,
    gridAutoRows: `${MOBILE_LAYOUT.HOME_ICON_CELL_HEIGHT_PX}px`,
    columnGap: `${MOBILE_LAYOUT.HOME_PAGE_GAP_PX}px`,
  } satisfies CSSProperties;

  const updatePage = (event: UIEvent<HTMLDivElement>): void => {
    const width = event.currentTarget.clientWidth;
    if (width > 0) {
      setCurrentPage(Math.round(event.currentTarget.scrollLeft / width));
    }
  };

  return (
    <main
      className={MOBILE_CLASS_NAME.HOME}
      aria-label={MOBILE_COPY.HOME_SCREEN}
      style={wallpaperUrl ? wallpaperStyle(wallpaperUrl) : undefined}
    >
      <div
        ref={pagesRef}
        className={MOBILE_CLASS_NAME.HOME_PAGES}
        aria-label={MOBILE_COPY.HOME_PAGES}
        onScroll={updatePage}
      >
        {pages.map((page, pageIndex) => (
          <section
            key={page[0]?.id ?? `empty-${pageIndex}`}
            className={MOBILE_CLASS_NAME.HOME_PAGE}
            style={pageStyle}
            aria-label={`${pageIndex + 1} / ${pages.length}`}
          >
            {page.map((item) => (
              <button
                key={item.id}
                className={MOBILE_CLASS_NAME.ICON}
                type="button"
                onClick={() =>
                  "entry" in item ? onOpenEntry(item.entry) : item.onOpen()
                }
              >
                <span className={MOBILE_CLASS_NAME.ICON_IMAGE}>
                  {"entry" in item ? (
                    <MobileEntryIcon entry={item.entry} gateway={gateway} />
                  ) : (
                    <img src={item.iconPath} alt="" draggable={false} />
                  )}
                </span>
                <span className={MOBILE_CLASS_NAME.ICON_LABEL}>{item.name}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className={MOBILE_CLASS_NAME.HOME_INDICATOR} aria-hidden="true">
        {pages.map((page, index) => (
          <i
            key={page[0]?.id ?? `dot-${index}`}
            className={MOBILE_CLASS_NAME.HOME_DOT}
            aria-current={index === currentPage ? "page" : undefined}
          />
        ))}
      </div>
      {error ? <p className={MOBILE_CLASS_NAME.ERROR} role="alert">{error}</p> : null}
    </main>
  );
}

function wallpaperStyle(
  url: string,
): CSSProperties & Record<`--${string}`, string> {
  return {
    [MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE]: `url(${JSON.stringify(url)})`,
  };
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}
