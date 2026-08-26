import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import {
  MOBILE_ASSET_PATHS,
  MOBILE_CLASS_NAME,
  MOBILE_COPY,
} from "@client/constants/shared/mobile";

interface MobileWidgetCatalogProps {
  readonly onCreate: (
    type: typeof WIDGET_TYPE.MEMO | typeof WIDGET_TYPE.DAILY_CHECKLIST,
  ) => void;
  readonly onOpenStorageStatus: () => void;
}

export function MobileWidgetCatalog({
  onCreate,
  onOpenStorageStatus,
}: MobileWidgetCatalogProps) {
  const items = [
    {
      id: WIDGET_TYPE.MEMO,
      label: MOBILE_COPY.CREATE_MEMO,
      icon: MOBILE_ASSET_PATHS.MEMO,
      run: () => onCreate(WIDGET_TYPE.MEMO),
    },
    {
      id: WIDGET_TYPE.DAILY_CHECKLIST,
      label: MOBILE_COPY.CREATE_CHECKLIST,
      icon: MOBILE_ASSET_PATHS.CHECKLIST,
      run: () => onCreate(WIDGET_TYPE.DAILY_CHECKLIST),
    },
    {
      id: WIDGET_TYPE.STORAGE_STATUS,
      label: MOBILE_COPY.OPEN_STORAGE_STATUS,
      icon: MOBILE_ASSET_PATHS.STORAGE_STATUS,
      run: onOpenStorageStatus,
    },
  ] as const;
  return (
    <MobileActivity title={MOBILE_COPY.MY_COMPUTER}>
      <p className={MOBILE_CLASS_NAME.MESSAGE}>
        {MOBILE_COPY.WIDGET_CATALOG_DESCRIPTION}
      </p>
      <ul className={MOBILE_CLASS_NAME.LIST}>
        {items.map((item) => (
          <li key={item.id}>
            <button className={MOBILE_CLASS_NAME.LIST_ITEM} type="button" onClick={item.run}>
              <span className={MOBILE_CLASS_NAME.LIST_ICON}>
                <img src={item.icon} alt="" />
              </span>
              <span className={MOBILE_CLASS_NAME.LIST_TEXT}>
                <strong>{item.label}</strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </MobileActivity>
  );
}
