import {
  useId,
  useRef,
  type KeyboardEvent,
} from "react";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import {
  XP_TAB_ID_PART,
  XP_TABS_CLASS_NAME,
} from "@client/constants/shared/xp-tabs";
import type { XpTabsProps } from "@client/types/shared/xp-tabs";

export function XpTabs<TabId extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className,
}: XpTabsProps<TabId>) {
  const instanceId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  if (!selected) return null;

  const selectAt = (index: number): void => {
    const tab = tabs[index];
    if (!tab || tab.disabled) return;
    onChange(tab.id);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    const enabledIndexes = tabs.flatMap((tab, candidateIndex) =>
      tab.disabled ? [] : [candidateIndex],
    );
    const enabledPosition = enabledIndexes.indexOf(index);
    if (enabledPosition < 0) return;
    let nextIndex: number | null = null;
    if (event.key === KEYBOARD_KEY.ARROW_RIGHT) {
      nextIndex = enabledIndexes[(enabledPosition + 1) % enabledIndexes.length] ?? null;
    } else if (event.key === KEYBOARD_KEY.ARROW_LEFT) {
      nextIndex =
        enabledIndexes[
          (enabledPosition - 1 + enabledIndexes.length) % enabledIndexes.length
        ] ?? null;
    } else if (event.key === KEYBOARD_KEY.HOME) {
      nextIndex = enabledIndexes[0] ?? null;
    } else if (event.key === KEYBOARD_KEY.END) {
      nextIndex = enabledIndexes.at(-1) ?? null;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    selectAt(nextIndex);
  };

  const rootClassName = [XP_TABS_CLASS_NAME.ROOT, className]
    .filter(Boolean)
    .join(" ");
  const selectedIndex = tabs.indexOf(selected);
  const selectedTabId = elementId(instanceId, XP_TAB_ID_PART.TAB, selected.id);
  const selectedPanelId = elementId(
    instanceId,
    XP_TAB_ID_PART.PANEL,
    selected.id,
  );

  return (
    <section className={rootClassName}>
      <div
        className={XP_TABS_CLASS_NAME.LIST}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={tab.id}
              ref={(button) => {
                buttonRefs.current[index] = button;
              }}
              id={elementId(instanceId, XP_TAB_ID_PART.TAB, tab.id)}
              type="button"
              role="tab"
              className={[
                XP_TABS_CLASS_NAME.TAB,
                isSelected ? XP_TABS_CLASS_NAME.TAB_SELECTED : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-selected={isSelected}
              aria-controls={elementId(
                instanceId,
                XP_TAB_ID_PART.PANEL,
                tab.id,
              )}
              tabIndex={isSelected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => selectAt(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={selectedPanelId}
        className={XP_TABS_CLASS_NAME.PANEL}
        role="tabpanel"
        aria-labelledby={selectedTabId}
      >
        {selected.panel}
      </div>
    </section>
  );
}

function elementId(instanceId: string, part: string, tabId: string): string {
  return `${instanceId}-${part}-${tabId}`;
}
