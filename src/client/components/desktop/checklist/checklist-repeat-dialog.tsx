import { useState } from "react";
import { CHECKLIST_REPEAT_CYCLES } from "@/constants/widgets/checklist-repeat";
import { checklistPeriod, isChecklistRepeatCycle } from "@/domain/widgets/checklist-period";
import type { DailyChecklistData } from "@/types/widgets/widget";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";
import { DesktopModal } from "@client/components/desktop/desktop-modal";
import { CHECKLIST_REPEAT_COPY as COPY } from "@client/content/ko/widgets/checklist-repeat";
import { formatKoreaDateTime } from "@client/utils/format-date-time";

export function ChecklistRepeatDialog({ data, controller, onClose }: {
  readonly data: DailyChecklistData;
  readonly controller: DailyChecklistController;
  readonly onClose: () => void;
}) {
  const [cycle, setCycle] = useState(data.repeatCycle ?? "daily");
  return <DesktopModal title={COPY.TITLE} closeDisabled={controller.isMutating} onRequestClose={() => { if (!controller.isMutating) onClose(); }}>
    <form onSubmit={(event) => {
      event.preventDefault();
      void controller.changeRepeatCycle(cycle).then((saved) => { if (saved) onClose(); });
    }}>
      <fieldset disabled={controller.isMutating}>
        <legend>{COPY.CYCLE}</legend>
        <select aria-label={COPY.CYCLE} value={cycle} onChange={(event) => {
          if (isChecklistRepeatCycle(event.target.value)) setCycle(event.target.value);
        }}>
          {CHECKLIST_REPEAT_CYCLES.map((value) => <option key={value} value={value}>{COPY.LABELS[value]} — {COPY.RULES[value]}</option>)}
        </select>
        <p>{COPY.NEXT}: {formatKoreaDateTime(new Date(checklistPeriod(Date.now(), cycle).end).toISOString())}</p>
        <p>{COPY.KEEP}</p>
        <div className="dialog-footer">
          <button type="submit">{COPY.SAVE}</button>
          <button type="button" onClick={onClose}>{COPY.CANCEL}</button>
        </div>
      </fieldset>
      {controller.error ? <p role="alert">{controller.error}</p> : null}
    </form>
  </DesktopModal>;
}
