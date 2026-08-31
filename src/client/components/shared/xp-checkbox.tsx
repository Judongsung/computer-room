import { useEffect, useId, useRef } from "react";
import { XP_CHECKBOX_CLASS_NAME } from "@client/constants/shared/xp";
import type { XpCheckboxProps } from "@client/types/shared/xp";

export function XpCheckbox({
  id,
  checked,
  disabled = false,
  indeterminate = false,
  label,
  labelVisuallyHidden = false,
  className,
  onCheckedChange,
}: XpCheckboxProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? generatedId;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const rootClassName = [
    XP_CHECKBOX_CLASS_NAME.ROOT,
    labelVisuallyHidden ? XP_CHECKBOX_CLASS_NAME.LABEL_HIDDEN : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={rootClassName}>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : checked}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
      <label htmlFor={inputId}>
        {labelVisuallyHidden ? (
          <span className="visually-hidden">{label}</span>
        ) : (
          label
        )}
      </label>
    </span>
  );
}
