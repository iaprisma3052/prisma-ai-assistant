import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, CandlestickData, Time, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { KlineData } from '@/types';

interface TradingChartProps {
  data: KlineData[];
  predictions?: Array<{ time: number; price: number }>;
  supports?: number[];
  resistances?: number[];
  height?: number;
}

const TradingChart: React.FC<TradingChartProps> = ({
  data,
  predictions = [],
  supports = [],
  resistances = [],
  height = 300,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#8b5cf6',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#8b5cf6',
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    if (data.length > 0) {
      const formattedData: CandlestickData[] = data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      candleSeries.setData(formattedData);
    }

    // Add prediction line if available
    if (predictions.length > 0) {
      const predictionSeries = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: 2,
        title: 'Previsão IA',
      });
      predictionSeries.setData(predictions.map((p) => ({
        time: p.time as Time,
        value: p.price,
      })));
    }

    // Add support lines
    supports.forEach((level) => {
      const series = chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 1,
        priceLineVisible: false,
      });
      if (data.length > 0) {
        series.setData([
          { time: data[0].time as Time, value: level },
          { time: data[data.length - 1].time as Time, value: level },
        ]);
      }
    });

    // Add resistance lines
    resistances.forEach((level) => {
      const series = chart.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 1,
        priceLineVisible: false,
      });
      if (data.length > 0) {
        series.setData([
          { time: data[0].time as Time, value: level },
          { time: data[data.length - 1].time as Time, value: level },
        ]);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height, data, predictions, supports, resistances]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
      
      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-green-500" />
          <span className="text-muted-foreground">Suporte</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-red-500" />
          <span className="text-muted-foreground">Resistência</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-muted-foreground">Previsão IA</span>
        </div>
      </div>
    </div>
  );
};

export default TradingChart;
