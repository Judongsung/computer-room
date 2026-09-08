import { expectTypeOf, it } from "vitest";
import type { MemoWidgetProps } from "@client/components/widgets/memo-widget";
import type { DailyChecklistWidgetProps } from "@client/components/widgets/daily-checklist-widget";
import type { StorageStatusWidgetProps } from "@client/components/widgets/storage-status-widget";
import type { AdminApplicationProps } from "@client/components/widgets/admin-application";
import type { ImageUploadProfilesWidgetProps } from "@client/components/widgets/image-upload-profiles-widget";
import type { MemoWidget, DailyChecklistWidget } from "@/types/widgets/widget";
import type { MemoGateway } from "@client/types/widgets/ports/memo";
import type { ChecklistGateway } from "@client/types/widgets/ports/checklist";
import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";

it("requires only each program's own ports and concrete widget", () => {
  expectTypeOf<MemoWidgetProps["widget"]>().toEqualTypeOf<MemoWidget>();
  expectTypeOf<MemoWidgetProps["gateway"]>().toEqualTypeOf<MemoGateway>();
  expectTypeOf<Parameters<MemoWidgetProps["onWidgetChange"]>[0]>().toEqualTypeOf<MemoWidget>();
  expectTypeOf<DailyChecklistWidgetProps["widget"]>().toEqualTypeOf<DailyChecklistWidget>();
  expectTypeOf<DailyChecklistWidgetProps["gateway"]>().toEqualTypeOf<ChecklistGateway>();
  expectTypeOf<DailyChecklistWidgetProps["checklistRetentionGateway"]>().toEqualTypeOf<ChecklistRetentionUseCases>();
  expectTypeOf<Parameters<DailyChecklistWidgetProps["onWidgetChange"]>[0]>().toEqualTypeOf<DailyChecklistWidget>();
  expectTypeOf<keyof StorageStatusWidgetProps>().toEqualTypeOf<"windowControls" | "storageStatusGateway">();
  expectTypeOf<keyof AdminApplicationProps>().toEqualTypeOf<"windowControls" | "guestAccessGateway">();
  expectTypeOf<keyof ImageUploadProfilesWidgetProps>().toEqualTypeOf<"windowControls" | "imageUploadProfileGateway" | "imageUploadLogGateway" | "onOpenFilesystemEntry">();
});
