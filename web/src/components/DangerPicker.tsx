import { DANGER_MAX } from "../api";
import { dangerLabel } from "../lib/format";
import { ChiliIcon } from "./icons";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Small note under the rating, e.g. where a suggested value came from. */
  hint?: string;
};

/** 1–5 chilli rating: peppers up to the chosen value light up. */
export default function DangerPicker({ value, onChange, hint }: Props) {
  return (
    <fieldset className="danger-picker">
      <legend>
        Danger <span className="optional">how likely you get chased</span>
      </legend>
      <div className="danger-options" role="radiogroup" aria-label="Danger rating">
        {Array.from({ length: DANGER_MAX }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of ${DANGER_MAX}: ${dangerLabel(n)}`}
            className={`danger-btn${n <= value ? " lit" : ""}${n === value ? " selected" : ""}`}
            onClick={() => onChange(n)}
          >
            <ChiliIcon size={26} className="danger-pepper" />
            <span className="danger-num" aria-hidden>
              {n}
            </span>
          </button>
        ))}
      </div>
      <p className="danger-preview" aria-live="polite">
        <strong>{dangerLabel(value)}</strong> · {value}/{DANGER_MAX}
        {hint && <span className="danger-hint"> · {hint}</span>}
      </p>
    </fieldset>
  );
}

/** Read-only peppers, e.g. in the spot sheet and search results. */
export function DangerPeppers({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <span className={`peppers${small ? " peppers-small" : ""}`} role="img" aria-label={`Danger ${value} of ${DANGER_MAX}`}>
      {Array.from({ length: DANGER_MAX }, (_, i) => (
        <ChiliIcon key={i} size={small ? 14 : 18} className={i < value ? "lit" : ""} />
      ))}
    </span>
  );
}
