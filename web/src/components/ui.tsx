import { useId, type ReactNode } from 'react';

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
          <input
            id={id}
            type="number"
            value={Number.isFinite(value) ? +(value * scale).toFixed(6) : ''}
            step={step}
            min={min}
            max={max}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(v / scale);
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

export function DateInput({ label, value, onChange, hint, min, max }: { label: string; value: string; onChange: (v: string) => void; hint?: string; min?: string; max?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />}
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
