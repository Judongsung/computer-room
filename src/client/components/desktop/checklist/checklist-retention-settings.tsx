import { useId } from "react";
import { CHECKLIST_RETENTION } from "@/constants/widgets/checklist-retention";
import { CHECKLIST_RETENTION_COPY as COPY } from "@client/content/ko/widgets/checklist-retention";
import { useChecklistRetention } from "@client/hooks/widgets/checklist/use-checklist-retention";
import { XpCheckbox } from "@client/components/shared/xp-checkbox";

export function ChecklistRetentionSettings() {
  const state = useChecklistRetention();
  const id = useId();
  return <section>
    <button type="button" aria-expanded={state.expanded}
      onClick={() => state.setExpanded(!state.expanded)}>
      {state.expanded ? COPY.CLOSE : COPY.OPEN}
    </button>
    {state.expanded ? <form onSubmit={(event) => { event.preventDefault(); void state.save(); }}>
      <p>{COPY.DESCRIPTION}</p>
      <p>{COPY.WARNING}</p>
      {state.busy && !state.loaded ? <p role="status">{COPY.LOADING}</p> : null}
      <fieldset disabled={state.busy || !state.loaded}>
        <XpCheckbox id={id} checked={state.unlimited} label={COPY.UNLIMITED}
          disabled={state.busy || !state.loaded} onCheckedChange={state.setUnlimited} />
        {!state.unlimited ? <p><label htmlFor={`${id}-days`}>{COPY.DAYS}</label>{" "}
          <input id={`${id}-days`} type="number" min={CHECKLIST_RETENTION.MIN_DAYS}
            max={CHECKLIST_RETENTION.MAX_DAYS} step={1} required value={state.days}
            onChange={(event) => state.setDays(event.target.value)} />
        </p> : null}
        <button type="submit">{COPY.SAVE}</button>
      </fieldset>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.saved ? <p role="status">{COPY.SAVED}</p> : null}
    </form> : null}
  </section>;
}
