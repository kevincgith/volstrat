import type { ReactNode } from 'react';

export function Placeholder({ title, phase, children }: { title: string; phase: string; children: ReactNode }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <div className="card placeholder">
        <span className="badge">{phase}</span>
        <div>{children}</div>
      </div>
    </section>
  );
}
