import type { ReactNode } from "react";

export interface XpTabDefinition<TabId extends string> {
  readonly id: TabId;
  readonly label: string;
  readonly panel: ReactNode;
  readonly disabled?: boolean;
}

export interface XpTabsProps<TabId extends string> {
  readonly tabs: readonly XpTabDefinition<TabId>[];
  readonly activeTab: TabId;
  readonly onChange: (tabId: TabId) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}
