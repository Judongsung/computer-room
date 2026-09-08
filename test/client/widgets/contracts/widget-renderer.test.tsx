import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetRenderer, type WidgetRendererProps } from "@client/components/widgets/widget-renderer";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import { memoWidget, checklistWidget } from "@test/support/widgets/dashboard-fixtures";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { fakeChecklistRetentionGateway } from "@test/support/widgets/checklist-retention-gateway";

const children = vi.hoisted(() => ({ memo: vi.fn(() => null), checklist: vi.fn(() => null), storage: vi.fn(() => null), profiles: vi.fn(() => null), admin: vi.fn(() => null) }));
vi.mock("@client/components/widgets/memo-widget", () => ({ MemoWidget: children.memo }));
vi.mock("@client/components/widgets/daily-checklist-widget", () => ({ DailyChecklistWidget: children.checklist }));
vi.mock("@client/components/widgets/storage-status-widget", () => ({ StorageStatusWidget: children.storage }));
vi.mock("@client/components/widgets/image-upload-profiles-widget", () => ({ ImageUploadProfilesWidget: children.profiles }));
vi.mock("@client/components/widgets/admin-application", () => ({ AdminApplication: children.admin }));

beforeEach(() => vi.clearAllMocks());

describe("lazy program composition", () => {
  it.each([WIDGET_TYPE.MEMO, WIDGET_TYPE.DAILY_CHECKLIST, WIDGET_TYPE.STORAGE_STATUS, WIDGET_TYPE.IMAGE_UPLOAD_PROFILES, WIDGET_TYPE.ADMIN])("connects only the required ports for %s", async (type) => {
    const base = memoWidget("program");
    const widget: DashboardWidget = type === WIDGET_TYPE.MEMO ? base
      : type === WIDGET_TYPE.DAILY_CHECKLIST ? checklistWidget("program", 0)
      : { ...base, type, file: null, data: null };
    const props: WidgetRendererProps = {
      widget, gateway: new FakeDashboardGateway(), checklistRetentionGateway: fakeChecklistRetentionGateway(),
      storageStatusGateway: { getStatus: vi.fn() },
      guestAccessGateway: { getSettings: vi.fn(), updateSettings: vi.fn(), listDirectory: vi.fn(), setEntryPublished: vi.fn() },
      imageUploadProfileGateway: { listProfiles: vi.fn(), createProfile: vi.fn(), updateProfile: vi.fn(), deleteProfile: vi.fn() },
      imageUploadLogGateway: { listImageUploadLogs: vi.fn(), getImageUploadLogSettings: vi.fn(), updateImageUploadLogRetentionDays: vi.fn() },
      onWidgetChange: vi.fn(), onOpenFilesystemEntry: vi.fn(),
      windowControls: { isActive: true, isMaximized: false, canSaveFile: false, onFocus: vi.fn(), onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn(), onSaveFile: vi.fn() },
    };
    render(<WidgetRenderer {...props} />);
    const cases = {
      [WIDGET_TYPE.MEMO]: [children.memo, { widget, gateway: props.gateway, onWidgetChange: props.onWidgetChange }],
      [WIDGET_TYPE.DAILY_CHECKLIST]: [children.checklist, { widget, gateway: props.gateway, onWidgetChange: props.onWidgetChange, checklistRetentionGateway: props.checklistRetentionGateway }],
      [WIDGET_TYPE.STORAGE_STATUS]: [children.storage, { storageStatusGateway: props.storageStatusGateway }],
      [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: [children.profiles, { imageUploadProfileGateway: props.imageUploadProfileGateway, imageUploadLogGateway: props.imageUploadLogGateway, onOpenFilesystemEntry: props.onOpenFilesystemEntry }],
      [WIDGET_TYPE.ADMIN]: [children.admin, { guestAccessGateway: props.guestAccessGateway }],
    } as const;
    const [child, expected] = cases[type];
    await waitFor(() => expect(child).toHaveBeenCalledWith({ ...expected, windowControls: props.windowControls }, undefined));
    for (const other of Object.values(children)) if (other !== child) expect(other).not.toHaveBeenCalled();
  });
});
