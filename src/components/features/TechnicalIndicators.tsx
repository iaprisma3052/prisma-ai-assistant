import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface IndicatorCardProps {
  name: string;
  value: number | string;
  signal: 'COMPRA' | 'VENDA' | 'NEUTRO';
  description?: string;
}

const IndicatorCard: React.FC<IndicatorCardProps> = ({ name, value, signal, description }) => {
  const getSignalStyles = () => {
    if (signal === 'COMPRA') return { color: 'green', icon: TrendingUp };
    if (signal === 'VENDA') return { color: 'red', icon: TrendingDown };
    return { color: 'slate', icon: Minus };
  };

  const { color, icon: Icon } = getSignalStyles();

  return (
    <div className={`bg-card/50 rounded-lg p-3 border-l-4 transition-all hover:bg-card ${
      color === 'green' ? 'border-green-500' : color === 'red' ? 'border-red-500' : 'border-muted'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`w-3 h-3 ${
            color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : 'text-muted-foreground'
          }`} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{name}</span>
        </div>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
          color === 'green' ? 'bg-green-500/20 text-green-400' :
          color === 'red' ? 'bg-red-500/20 text-red-400' :
          'bg-muted text-muted-foreground'
        }`}>
          {signal}
        </span>
      </div>
      <div className="text-lg font-black text-foreground">{value}</div>
      {description && <p className="text-[10px] text-muted-foreground italic truncate">{description}</p>}
    </div>
  );
};

interface TechnicalIndicatorsProps {
  rsi?: number | null;
  macd?: { macd: number; signal: number; histogram: number } | null;
  bollinger?: { upper: number; middle: number; lower: number } | null;
  sma20?: number | null;
  sma50?: number | null;
  volume?: number;
  currentPrice?: number;
  pattern?: string;
}

const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({
  rsi,
  macd,
  bollinger,
  sma20,
  sma50,
  volume,
  currentPrice = 0,
  pattern,
}) => {
  const getRSISignal = (value: number): 'COMPRA' | 'VENDA' | 'NEUTRO' => {
    if (value < 30) return 'COMPRA';
    if (value > 70) return 'VENDA';
    return 'NEUTRO';
  };

  const getMACDSignal = (macdValue: number, signalValue: number): 'COMPRA' | 'VENDA' | 'NEUTRO' => {
    if (macdValue > signalValue) return 'COMPRA';
    if (macdValue < signalValue) return 'VENDA';
    return 'NEUTRO';
  };

  const getBollingerSignal = (price: number, upper: number, lower: number): 'COMPRA' | 'VENDA' | 'NEUTRO' => {
    if (price <= lower) return 'COMPRA';
    if (price >= upper) return 'VENDA';
    return 'NEUTRO';
  };

  const getSMASignal = (price: number, sma: number): 'COMPRA' | 'VENDA' | 'NEUTRO' => {
    if (price > sma) return 'COMPRA';
    if (price < sma) return 'VENDA';
    return 'NEUTRO';
  };

  const indicators = [
    rsi !== undefined && rsi !== null && {
      name: 'RSI (14)',
      value: rsi.toFixed(2),
      signal: getRSISignal(rsi),
      description: rsi < 30 ? 'Sobrevendido' : rsi > 70 ? 'Sobrecomprado' : 'Zona neutra',
    },
    macd && {
      name: 'MACD',
      value: macd.macd.toFixed(5),
      signal: getMACDSignal(macd.macd, macd.signal),
      description: `Histograma: ${macd.histogram.toFixed(5)}`,
    },
    bollinger && currentPrice > 0 && {
      name: 'BOLLINGER',
      value: currentPrice.toFixed(5),
      signal: getBollingerSignal(currentPrice, bollinger.upper, bollinger.lower),
      description: `U: ${bollinger.upper.toFixed(5)} L: ${bollinger.lower.toFixed(5)}`,
    },
    sma20 && currentPrice > 0 && {
      name: 'SMA 20',
      value: sma20.toFixed(5),
      signal: getSMASignal(currentPrice, sma20),
      description: currentPrice > sma20 ? 'Acima da média' : 'Abaixo da média',
    },
  ].filter(Boolean) as Array<{ name: string; value: string; signal: 'COMPRA' | 'VENDA' | 'NEUTRO'; description: string }>;

  const buyCount = indicators.filter((i) => i.signal === 'COMPRA').length;
  const sellCount = indicators.filter((i) => i.signal === 'VENDA').length;
  const neutralCount = indicators.filter((i) => i.signal === 'NEUTRO').length;

  return (
    <div className="glass-effect rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          INDICADORES
        </h3>
        {pattern && (
          <span className="text-[10px] font-medium text-primary bg-primary/20 px-2 py-0.5 rounded-full">
            {pattern}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {indicators.map((indicator, idx) => (
          <IndicatorCard key={idx} {...indicator} />
        ))}
      </div>

      {/* Consensus */}
      <div className="p-3 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 rounded-lg border border-cyan-500/30">
        <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-bold mb-2">
          <BarChart3 className="w-3 h-3" />
          CONSENSO
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-black text-green-400">{buyCount}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Compra</div>
          </div>
          <div>
            <div className="text-lg font-black text-muted-foreground">{neutralCount}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Neutro</div>
          </div>
          <div>
            <div className="text-lg font-black text-red-400">{sellCount}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Venda</div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            buyCount > sellCount ? 'bg-green-500/20 text-green-400' :
            sellCount > buyCount ? 'bg-red-500/20 text-red-400' :
            'bg-muted text-muted-foreground'
          }`}>
            {buyCount > sellCount ? 'VIÉS COMPRA' : sellCount > buyCount ? 'VIÉS VENDA' : 'NEUTRO'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TechnicalIndicators;
