import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import {
  WIDGET_BEHAVIOR,
  WIDGET_FILE_DEFAULT_LAYOUT,
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "@/domain/filesystem/filesystem-name";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { normalizeChecklistLabel } from "@/domain/widgets/checklist";
import { validateMemoMarkdown } from "@/domain/widgets/memo";
import { validateWidgetLayout } from "@/domain/widgets/widget-layout-validation";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type {
  CreateWidgetFileInput,
  NewWidgetFileDraft,
  WidgetFileDocument,
} from "@/types/widgets/widget-file";
import type { WidgetFileDraftRepository } from "@/types/widgets/widget-file-repository";
import type { WidgetFileUseCases } from "@/types/widgets/widget-file-service";
import type { WidgetReader } from "@/types/widgets/widget-service";

export class WidgetFileService implements WidgetFileUseCases {
  constructor(
    private readonly widgets: WidgetReader,
    private readonly filesystem: DirectoryRepository,
    private readonly drafts: WidgetFileDraftRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async get(entryId: string): Promise<WidgetFileDocument> {
    const record = await this.filesystem.findEntryWithinRoots(
      entryId,
      FILESYSTEM_ACTIVE_ROOT_IDS,
    );
    if (
      !record ||
      record.kind !== FILESYSTEM_ENTRY_KIND.WIDGET ||
      !record.widgetId
    ) {
      throw new AppError(FILESYSTEM_ERRORS.ENTRY_NOT_FOUND);
    }
    const entry = toPublicEntry(record);
    if (entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return { entry, widget: await this.widgets.getWidget(record.widgetId) };
  }

  async create(input: CreateWidgetFileInput): Promise<WidgetFileDocument> {
    if (!WIDGET_BEHAVIOR[input.type].supportsFileStorage) {
      throw new AppError(WIDGET_ERRORS.WIDGET_FILE_NOT_SUPPORTED);
    }
    await this.requireActiveDirectory(input.parentId);
    const requestedName = normalizeFilesystemName(input.name);
    const occupied = new Set(
      await this.filesystem.listNameKeys(input.parentId),
    );
    const name = availableFilesystemName(requestedName, occupied);
    const createdAt = this.clock.now();
    const widgetId = this.ids.generate();
    const entryId = this.ids.generate();
    const policy = WIDGET_WINDOW_POLICY[input.type];
    const widget = validateWidgetLayout([
      {
        id: widgetId,
        type: input.type,
        position: WIDGET_FILE_DEFAULT_LAYOUT.POSITION,
        size: {
          width: policy.DEFAULT_WIDTH,
          height: policy.DEFAULT_HEIGHT,
        },
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
        stackOrder: WIDGET_FILE_DEFAULT_LAYOUT.STACK_ORDER,
      },
    ])[0];
    if (!widget) {
      throw new AppError(WIDGET_ERRORS.INVALID_LAYOUT);
    }
    const desktopOrder = await nextDesktopOrder(
      this.filesystem,
      input.parentId,
    );
    const draft = {
      widget,
      entry: {
        id: entryId,
        widgetId,
        widgetType: input.type,
        parentId: input.parentId,
        name,
        nameKey: filesystemNameKey(name),
        createdAt,
        ...(desktopOrder === undefined ? {} : { desktopOrder }),
      },
      createdAt,
      content: this.createContent(input, createdAt),
    } satisfies NewWidgetFileDraft;
    await this.drafts.insert(draft);
    return this.get(entryId);
  }

  private createContent(
    input: CreateWidgetFileInput,
    createdAt: number,
  ): NewWidgetFileDraft["content"] {
    if (input.type === WIDGET_TYPE.MEMO) {
      return {
        type: WIDGET_TYPE.MEMO,
        markdown: validateMemoMarkdown(input.data.markdown),
      };
    }
    if (input.data.items.length > MAX_ACTIVE_CHECKLIST_ITEMS) {
      throw new AppError(CHECKLIST_ERRORS.TOO_MANY_ITEMS);
    }
    return {
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      businessDate: getKoreaDateContext(createdAt).businessDate,
      items: input.data.items.map((item) => ({
        id: this.ids.generate(),
        label: normalizeChecklistLabel(item.label),
        checked: item.checked,
      })),
    };
  }

  private async requireActiveDirectory(id: string): Promise<void> {
    const entry = await this.filesystem.findEntryWithinRoots(
      id,
      FILESYSTEM_ACTIVE_ROOT_IDS,
    );
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
  }
}
