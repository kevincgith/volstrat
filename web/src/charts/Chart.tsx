import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useTheme } from '../theme';

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  VisualMapComponent,
  AxisPointerComponent,
  CanvasRenderer,
]);

export interface ChartHandle {
  toPNG: (name: string) => void;
}

interface Props {
  option: EChartsCoreOption;
  height?: number;
  /** Charts sharing a group id synchronise tooltips and zoom. */
  group?: string;
  ariaLabel: string;
}

export const Chart = forwardRef<ChartHandle, Props>(function Chart({ option, height = 320, group, ariaLabel }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, undefined, { renderer: 'canvas' });
    inst.current = chart;
    if (group) {
      chart.group = group;
      echarts.connect(group);
    }
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, [group]);

  useEffect(() => {
    inst.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option, theme]);

  useImperativeHandle(ref, () => ({
    toPNG(name: string) {
      const c = inst.current;
      if (!c) return;
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff';
      const url = c.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: bg });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.png`;
      a.click();
    },
  }));

  return <div ref={el} style={{ height, width: '100%' }} role="img" aria-label={ariaLabel} />;
});
