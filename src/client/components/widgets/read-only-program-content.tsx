import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DailyChecklistData, MemoData } from "@/types/widgets/widget";
import { MarkdownContent } from "@client/components/widgets/markdown-content";
import { READ_ONLY_PROGRAM_CLASS_NAME } from "@client/constants/widgets/read-only-program";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";

type ReadOnlyProgram =
  | {
      readonly type: typeof WIDGET_TYPE.MEMO;
      readonly data: MemoData;
    }
  | {
      readonly type: typeof WIDGET_TYPE.DAILY_CHECKLIST;
      readonly data: DailyChecklistData;
    };

interface ReadOnlyProgramContentProps {
  readonly program: ReadOnlyProgram;
}

export function ReadOnlyProgramContent({
  program,
}: ReadOnlyProgramContentProps) {
  return (
    <div className={READ_ONLY_PROGRAM_CLASS_NAME.ROOT}>
      {program.type === WIDGET_TYPE.MEMO ? (
        <ReadOnlyMemoContent markdown={program.data.markdown} />
      ) : (
        <ReadOnlyChecklistContent data={program.data} />
      )}
    </div>
  );
}

export function ReadOnlyMemoContent({ markdown }: { readonly markdown: string }) {
  return <MarkdownContent markdown={markdown} />;
}

export function ReadOnlyChecklistContent({
  data,
}: {
  readonly data: DailyChecklistData;
}) {
  return (
    <div className={READ_ONLY_PROGRAM_CLASS_NAME.CHECKLIST}>
      <p className={READ_ONLY_PROGRAM_CLASS_NAME.CHECKLIST_DATE}>
        {CHECKLIST_WIDGET_COPY.DATE(data.businessDate)}
      </p>
      <ul className={READ_ONLY_PROGRAM_CLASS_NAME.CHECKLIST_ITEMS}>
        {data.items.map((item) => (
          <li
            key={item.id}
            className={READ_ONLY_PROGRAM_CLASS_NAME.CHECKLIST_ITEM}
          >
            <input type="checkbox" checked={item.checked} readOnly />
            {item.checked ? <del>{item.label}</del> : <span>{item.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
