import { nextDesktopOrder } from "@/application/filesystem/desktop-placement";
import { toPublicEntry } from "@/application/filesystem/filesystem-entry-mapper";
import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
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
  filesystemNameKey,
} from "@/domain/filesystem/filesystem-name";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { normalizeChecklistLabel } from "@/domain/widgets/checklist";
import { validateMemoMarkdown } from "@/domain/widgets/memo";
import { validateWidgetLayout } from "@/domain/widgets/widget-layout-validation";
import type { DirectoryRepository } from "@/types/filesystem/repository";
import type {
  ActiveFilesystemEntryResolver as ActiveFilesystemEntryResolverPort,
  FilesystemNameAllocator as FilesystemNameAllocatorPort,
} from "@/types/filesystem/policies/filesystem-policies";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "@/types/filesystem/filesystem";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type {
  CreateWidgetFileInput,
  CreateWidgetFileInputByType,
  NewWidgetFileDraft,
  WidgetFileDraftContentByType,
  WidgetFileDocument,
  WidgetFileType,
} from "@/types/widgets/widget-file";
import type { WidgetFileDraftRepository } from "@/types/widgets/widget-file-repository";
import type { WidgetFileUseCases } from "@/types/widgets/widget-file-service";
import type { WidgetReader } from "@/types/widgets/widget-service";
import type { DashboardWidget } from "@/types/widgets/widget";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";

export class WidgetFileService implements WidgetFileUseCases {
  constructor(
    private readonly widgets: WidgetReader,
    private readonly filesystem: DirectoryRepository,
    private readonly drafts: WidgetFileDraftRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly activeEntries: ActiveFilesystemEntryResolverPort =
      new ActiveFilesystemEntryResolver(filesystem),
    private readonly names: FilesystemNameAllocatorPort =
      new FilesystemNameAllocator(filesystem),
  ) {}

  async get(entryId: string): Promise<WidgetFileDocument> {
    const record = await this.activeEntries.find(entryId);
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
    const name = await this.names.allocate(input.parentId, input.name);
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

  async save(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }> {
    const widget = await this.widgets.getWidget(widgetId);
    if (!WIDGET_BEHAVIOR[widget.type].supportsFileStorage) {
      throw new AppError(WIDGET_ERRORS.WIDGET_FILE_NOT_SUPPORTED);
    }
    if (widget.file) {
      throw new AppError(WIDGET_ERRORS.WIDGET_ALREADY_SAVED);
    }

    await this.requireActiveDirectory(input.parentId);
    const name = await this.names.allocate(input.parentId, input.name);
    const createdAt = this.clock.now();
    const desktopOrder = await nextDesktopOrder(
      this.filesystem,
      input.parentId,
      input.desktopPlacement,
    );
    const entryId = this.ids.generate();
    await this.filesystem.insertWidget({
      id: entryId,
      widgetId,
      widgetType: widget.type,
      parentId: input.parentId,
      name,
      nameKey: filesystemNameKey(name),
      createdAt,
      ...(desktopOrder === undefined ? {} : { desktopOrder }),
    });

    const record = await this.filesystem.findEntry(entryId);
    const entry = record ? toPublicEntry(record) : null;
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return {
      entry,
      widget: await this.widgets.getWidget(widgetId),
    };
  }

  private createContent(
    input: CreateWidgetFileInput,
    createdAt: number,
  ): NewWidgetFileDraft["content"] {
    return createWidgetFileDraftContent(input, {
      createdAt,
      generateId: () => this.ids.generate(),
    });
  }

  private async requireActiveDirectory(id: string): Promise<void> {
    await this.activeEntries.requireDirectory(id, {
      notFound: FILESYSTEM_ERRORS.INVALID_PARENT,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    });
  }
}

interface WidgetFileDraftFactoryContext {
  readonly createdAt: number;
  readonly generateId: () => string;
}

type WidgetFileDraftFactoryMap = {
  readonly [T in WidgetFileType]: (
    input: CreateWidgetFileInputByType<T>,
    context: WidgetFileDraftFactoryContext,
  ) => WidgetFileDraftContentByType<T>;
};

const WIDGET_FILE_DRAFT_FACTORIES = {
  [WIDGET_TYPE.MEMO]: (
    input: CreateWidgetFileInputByType<typeof WIDGET_TYPE.MEMO>,
  ) => ({
    type: WIDGET_TYPE.MEMO,
    markdown: validateMemoMarkdown(input.data.markdown),
  }),
  [WIDGET_TYPE.DAILY_CHECKLIST]: (
    input: CreateWidgetFileInputByType<typeof WIDGET_TYPE.DAILY_CHECKLIST>,
    context: WidgetFileDraftFactoryContext,
  ) => {
    if (input.data.items.length > MAX_ACTIVE_CHECKLIST_ITEMS) {
      throw new AppError(CHECKLIST_ERRORS.TOO_MANY_ITEMS);
    }
    return {
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      businessDate: getKoreaDateContext(context.createdAt).businessDate,
      items: input.data.items.map((item) => ({
        id: context.generateId(),
        label: normalizeChecklistLabel(item.label),
        checked: item.checked,
      })),
    };
  },
} satisfies WidgetFileDraftFactoryMap;

function createWidgetFileDraftContent<T extends WidgetFileType>(
  input: CreateWidgetFileInputByType<T>,
  context: WidgetFileDraftFactoryContext,
): WidgetFileDraftContentByType<T> {
  const factory = WIDGET_FILE_DRAFT_FACTORIES[input.type] as unknown as (
    candidate: CreateWidgetFileInputByType<T>,
    factoryContext: WidgetFileDraftFactoryContext,
  ) => WidgetFileDraftContentByType<T>;
  return factory(input, context);
}
