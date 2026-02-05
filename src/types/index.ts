export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MACD {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface PricePrediction {
  predictedPrice: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
}

export interface TradingSignal {
  type: 'CALL' | 'PUT' | 'AGUARDAR';
  pattern: string;
  reason: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number;
  timestamp: Date;
  entryTime?: string;
}
