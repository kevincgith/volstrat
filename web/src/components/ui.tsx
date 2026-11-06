import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} title={hint}>
        {label}
        {hint && <span className="hint-dot" aria-hidden="true">?</span>}
      </label>
      {children(id)}
    </div>
  );
}

/**
 * A number box that only applies a value once it is finished: on Enter, on leaving the field,
 * or on the arrow keys / spinner. While typing, the text is a local draft, so a value is never
 * clamped, sorted or re-run half-typed (typing 150 into a field with a minimum of 20 used to
 * snap to 20 at the "1"). An empty or invalid entry reverts to the current value, unless
 * `allowEmpty` is set, in which case it commits `null`.
 */
export function NumField({
  value,
  onCommit,
  scale = 1,
  allowEmpty = false,
  ...rest
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  scale?: number;
  allowEmpty?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const shown = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? String(+(v * scale).toFixed(6)) : '');
  const [draft, setDraft] = useState(() => shown(value));
  const editing = useRef(false);
  const downValue = useRef<string | null>(null);
  // follow outside changes (presets, links) unless the user is mid-edit
  useEffect(() => {
    if (!editing.current) setDraft(shown(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, scale]);
  const commit = (text: string) => {
    editing.current = false;
    const t = text.trim();
    if (t === '' && allowEmpty) {
      onCommit(null);
      return;
    }
    const x = parseFloat(t);
    if (Number.isFinite(x)) {
      const v = x / scale;
      onCommit(v);
      setDraft(shown(v));
    } else setDraft(shown(value));
  };
  return (
    <input
      {...rest}
      type="number"
      value={draft}
      onFocus={(e) => {
        editing.current = true;
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        editing.current = true;
        setDraft(e.target.value);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        else if (e.key === 'Escape') {
          editing.current = false;
          setDraft(shown(value));
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') commit((e.target as HTMLInputElement).value);
      }}
      onPointerDown={(e) => {
        downValue.current = (e.target as HTMLInputElement).value;
      }}
      onPointerUp={(e) => {
        // a spinner click changes the value while the button is held; a click to focus or select does not
        const el = e.target as HTMLInputElement;
        if (downValue.current !== null && el.value !== downValue.current) commit(el.value);
        downValue.current = null;
      }}
    />
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
  scale = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  /** Display multiplier, e.g. 100 to edit a fraction as a percentage. */
  scale?: number;
  suffix?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="input-suffix">
          <NumField
            id={id}
            value={value}
            scale={scale}
            step={step}
            min={min}
            max={max}
            onCommit={(v) => {
              if (v != null) onChange(v);
            }}
          />
          {suffix && <span>{suffix}</span>}
        </div>
      )}
    </Field>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const o = options.find((x) => String(x.value) === e.target.value);
            if (o) onChange(o.value);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** A complete, plausible date (a typed year passes through 0002, 0020, 0202 on the way). */
const isFullDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && +v.slice(0, 4) >= 1900 && +v.slice(0, 4) <= 2100;

/**
 * A date box that applies only complete dates: a date picked from the calendar, or a typed date
 * once its year is complete, or whatever is in the box on Enter / leaving the field. A cleared box
 * commits "" (e.g. End = latest data); an incomplete one reverts.
 */
export function DateInput({ label, value, onChange, hint, min, max }: { label: string; value: string; onChange: (v: string) => void; hint?: string; min?: string; max?: string }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  const commit = (v: string) => {
    editing.current = false;
    if (v === '' || isFullDate(v)) {
      if (v !== value) onChange(v);
      setDraft(v);
    } else setDraft(value);
  };
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          type="date"
          value={draft}
          min={min}
          max={max}
          onFocus={() => (editing.current = true)}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            editing.current = true;
            if (isFullDate(v) && v !== value) onChange(v);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
        />
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange, title }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="toggle" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Loading({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="card error" role="alert">
      <strong>Could not load data.</strong> {message}
    </div>
  );
}
