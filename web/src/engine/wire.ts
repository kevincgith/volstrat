/** Structured-clone-safe version of RunResult (component defs carry functions). */
import type { RunResult } from './run';

export interface WireComponent {
  id: string;
  raw: Float64Array;
  score: Float64Array;
}

export type WireResult = Omit<RunResult, 'score'> & {
  score: Omit<RunResult['score'], 'components'> & { components: WireComponent[] };
};

export function toWire(r: RunResult): WireResult {
  return {
    ...r,
    score: {
      ...r.score,
      components: r.score.components.map((c) => ({ id: c.def.id, raw: c.raw, score: c.score })),
    },
  };
}
