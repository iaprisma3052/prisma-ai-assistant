import { KlineData } from '@/types';

class IndicatorService {
  calculateRSI(data: KlineData[], period: number = 14): number | null {
    if (data.length < period + 1) return null;
    
    const changes = data.slice(1).map((d, i) => d.close - data[i].close);
    const recentChanges = changes.slice(-period);
    
    const gains = recentChanges.filter((c) => c > 0);
    const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [];
    
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(ema);
    
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      result.push(ema);
    }
    
    return result;
  }

  calculateMACD(
    data: KlineData[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd: number; signal: number; histogram: number } | null {
    if (data.length < slowPeriod + signalPeriod) return null;
    
    const closes = data.map((d) => d.close);
    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);
    
    const macdLine = fastEMA.map((fast, i) => fast - (slowEMA[i] || slowEMA[slowEMA.length - 1]));
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    const macd = macdLine[macdLine.length - 1] || 0;
    const signal = signalLine[signalLine.length - 1] || 0;
    
    return {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  calculateSMA(data: KlineData[], period: number): number | null {
    if (data.length < period) return null;
    
    const sum = data.slice(-period).reduce((a, b) => a + b.close, 0);
    return sum / period;
  }

  calculateBollingerBands(
    data: KlineData[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } | null {
    if (data.length < period) return null;
    
    const periodData = data.slice(-period);
    const mean = periodData.reduce((a, b) => a + b.close, 0) / period;
    
    const variance = periodData.reduce((sum, d) => sum + Math.pow(d.close - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      upper: mean + stdDev * std,
      middle: mean,
      lower: mean - stdDev * std,
    };
  }

  detectSupportsResistances(data: KlineData[]): { supports: number[]; resistances: number[] } {
    const supports: number[] = [];
    const resistances: number[] = [];
    const lookback = 5;

    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      const leftData = data.slice(i - lookback, i);
      const rightData = data.slice(i + 1, i + lookback + 1);

      const isLocalLow = leftData.every((d) => d.low >= current.low) &&
                         rightData.every((d) => d.low >= current.low);
      const isLocalHigh = leftData.every((d) => d.high <= current.high) &&
                          rightData.every((d) => d.high <= current.high);

      if (isLocalLow) supports.push(current.low);
      if (isLocalHigh) resistances.push(current.high);
    }

    return {
      supports: [...new Set(supports)].slice(-3),
      resistances: [...new Set(resistances)].slice(-3),
    };
  }

  detectPattern(data: KlineData[]): string {
    if (data.length < 10) return 'AGUARDANDO DADOS';

    const recent = data.slice(-10);
    const firstHalf = recent.slice(0, 5);
    const secondHalf = recent.slice(5);

    const firstLow = Math.min(...firstHalf.map((d) => d.low));
    const secondLow = Math.min(...secondHalf.map((d) => d.low));
    const firstHigh = Math.max(...firstHalf.map((d) => d.high));
    const secondHigh = Math.max(...secondHalf.map((d) => d.high));

    if (Math.abs(firstLow - secondLow) / firstLow < 0.01 && secondHigh > firstHigh) {
      return 'PADRÃO W - FUNDO DUPLO';
    }

    if (Math.abs(firstHigh - secondHigh) / firstHigh < 0.01 && secondLow < firstLow) {
      return 'PADRÃO M - TOPO DUPLO';
    }

    const lastCandle = data[data.length - 1];
    const bodySize = Math.abs(lastCandle.close - lastCandle.open);
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
      return 'HAMMER - REJEIÇÃO DE FUNDO';
    }

    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
      return 'SHOOTING STAR - REJEIÇÃO DE TOPO';
    }

    const closes = data.slice(-5).map(d => d.close);
    const isUptrend = closes.every((c, i, arr) => i === 0 || c >= arr[i - 1]);
    const isDowntrend = closes.every((c, i, arr) => i === 0 || c <= arr[i - 1]);

    if (isUptrend) return 'TENDÊNCIA DE ALTA';
    if (isDowntrend) return 'TENDÊNCIA DE BAIXA';

    return 'CONSOLIDAÇÃO';
  }
}

export const indicatorService = new IndicatorService();
