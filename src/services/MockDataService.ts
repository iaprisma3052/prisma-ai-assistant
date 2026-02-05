import { KlineData } from '@/types';

class MockDataService {
  private basePrice = 1.0850;
  private volatility = 0.0015;
  private data: KlineData[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  generateInitialData(count: number = 50): KlineData[] {
    const now = Math.floor(Date.now() / 1000);
    const data: KlineData[] = [];
    let price = this.basePrice;

    for (let i = count; i > 0; i--) {
      const time = now - i * 60; // 1 minute candles
      const change = (Math.random() - 0.5) * this.volatility;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * this.volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * this.volatility * 0.5;
      
      data.push({
        time,
        open: Number(open.toFixed(5)),
        high: Number(high.toFixed(5)),
        low: Number(low.toFixed(5)),
        close: Number(close.toFixed(5)),
        volume: Math.floor(Math.random() * 1000) + 100,
      });
      
      price = close;
    }

    this.data = data;
    return data;
  }

  generateNextCandle(): KlineData {
    const lastCandle = this.data[this.data.length - 1];
    const time = lastCandle.time + 60;
    
    // Add some trend and noise
    const trend = Math.random() > 0.5 ? 1 : -1;
    const change = trend * Math.random() * this.volatility;
    
    const open = lastCandle.close;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * this.volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * this.volatility * 0.5;

    const newCandle: KlineData = {
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume: Math.floor(Math.random() * 1000) + 100,
    };

    this.data.push(newCandle);
    // Keep last 100 candles
    if (this.data.length > 100) {
      this.data.shift();
    }

    return newCandle;
  }

  startRealtime(callback: (data: KlineData[]) => void, intervalMs: number = 5000): void {
    if (this.intervalId) {
      this.stopRealtime();
    }

    this.intervalId = setInterval(() => {
      this.generateNextCandle();
      callback([...this.data]);
    }, intervalMs);
  }

  stopRealtime(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getData(): KlineData[] {
    return [...this.data];
  }
}

export const mockDataService = new MockDataService();
