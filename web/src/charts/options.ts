/** ECharts option builders shared by the pages. */
import type { Colors } from './palette';

/** Compact tooltip number: 4 significant digits, thousands separators for large values. */
export function fmtTip(v: number): string {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function baseOption(c: Colors) {
  return {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'Inter', system-ui, sans-serif", color: c.ink2, fontSize: 11 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: c.muted, width: 1 } },
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.ink, fontSize: 12 },
      confine: true,
      valueFormatter: (v: unknown) => (typeof v === 'number' ? fmtTip(v) : v == null ? '–' : String(v)),
    },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2 }, itemWidth: 14, itemHeight: 3, icon: 'rect' },
  };
}

export function timeAxis(c: Colors, dates: string[], gridIndex = 0, show = true) {
  return {
    type: 'category',
    data: dates,
    gridIndex,
    boundaryGap: false,
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
    axisLabel: { show, color: c.muted, hideOverlap: true, formatter: (v: string) => v.slice(0, 7) },
    splitLine: { show: false },
  };
}

export function valueAxis(c: Colors, opts: Record<string, unknown> = {}) {
  return {
    type: 'value',
    scale: true,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: c.muted },
    splitLine: { lineStyle: { color: c.grid, width: 1 } },
    ...opts,
  };
}

export function zoom(xAxisIndex: number[] | number, startPct = 0) {
  return [
    // wheel scrolls the page; shift+wheel zooms; drag pans
    { type: 'inside', xAxisIndex, start: startPct, end: 100, zoomOnMouseWheel: 'shift', moveOnMouseWheel: false },
    { type: 'slider', xAxisIndex, start: startPct, end: 100, height: 18, bottom: 4, brushSelect: false },
  ];
}

export function line(name: string, data: ArrayLike<number>, color: string, opts: Record<string, unknown> = {}) {
  return {
    name,
    type: 'line',
    data: Array.from(data, (v) => (Number.isFinite(v) ? v : null)),
    showSymbol: false,
    symbolSize: 8,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    emphasis: { focus: 'series', lineStyle: { width: 2 } },
    sampling: 'lttb',
    connectNulls: false,
    ...opts,
  };
}

/** markArea spans for non-neutral regimes. */
export function regimeAreas(dates: string[], regimes: ArrayLike<number>, c: Colors, from = 0, to = dates.length - 1) {
  const data: unknown[] = [];
  let i = from;
  while (i <= to) {
    const r = regimes[i]!;
    let j = i;
    while (j + 1 <= to && regimes[j + 1] === r) j++;
    if (r >= 0 && r !== 2) {
      data.push([{ xAxis: dates[i], itemStyle: { color: c.regimeFill[r] } }, { xAxis: dates[j] }]);
    }
    i = j + 1;
  }
  return { silent: true, data };
}

export const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '–');
export const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
