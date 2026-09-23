import { useId, type CSSProperties, type ReactNode } from 'react';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  legend: string;
  hint?: ReactNode;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** A radio group drawn as a segmented control, with 44px+ tap targets. */
export function SegmentedField<T extends string | number>({ legend, hint, options, value, onChange }: Props<T>) {
  const name = useId();
  const hintId = useId();
  return (
    <fieldset className="field segmented-field" aria-describedby={hint ? hintId : undefined}>
      <legend>{legend}</legend>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      <div
        className="segmented"
        data-count={options.length}
        style={{ '--count': options.length } as CSSProperties}
      >
        {options.map((option) => (
          <label className="segment" key={option.value}>
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
