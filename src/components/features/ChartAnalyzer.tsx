import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Play, Square, Loader2, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SignalDisplay from './SignalDisplay';
import TradingChart from './TradingChart';
import TechnicalIndicators from './TechnicalIndicators';
import { mockDataService } from '@/services/MockDataService';
import { indicatorService } from '@/services/IndicatorService';
import { KlineData } from '@/types';

interface AnalysisResult {
  signal: 'COMPRA' | 'VENDA' | 'NEUTRO';
  confidence: number;
  analysis: string;
  timestamp: number;
  entryTime: string;
}

interface ChartAnalyzerProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
}

export default function ChartAnalyzer({ onAnalysisComplete }: ChartAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [chartData, setChartData] = useState<KlineData[]>([]);
  const [indicators, setIndicators] = useState<{
    rsi: number | null;
    macd: { macd: number; signal: number; histogram: number } | null;
    bollinger: { upper: number; middle: number; lower: number } | null;
    sma20: number | null;
    pattern: string;
    supports: number[];
    resistances: number[];
  }>({
    rsi: null,
    macd: null,
    bollinger: null,
    sma20: null,
    pattern: '',
    supports: [],
    resistances: [],
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Calculate indicators when chart data changes
  const updateIndicators = useCallback((data: KlineData[]) => {
    if (data.length < 20) return;

    const rsi = indicatorService.calculateRSI(data);
    const macd = indicatorService.calculateMACD(data);
    const bollinger = indicatorService.calculateBollingerBands(data);
    const sma20 = indicatorService.calculateSMA(data, 20);
    const pattern = indicatorService.detectPattern(data);
    const { supports, resistances } = indicatorService.detectSupportsResistances(data);

    setIndicators({
      rsi,
      macd,
      bollinger,
      sma20,
      pattern,
      supports,
      resistances,
    });
  }, []);

  // Initialize and update chart data
  useEffect(() => {
    const initialData = mockDataService.generateInitialData(50);
    setChartData(initialData);
    updateIndicators(initialData);
  }, [updateIndicators]);

  // Start real-time updates when streaming
  useEffect(() => {
    if (isStreaming) {
      mockDataService.startRealtime((newData) => {
        setChartData(newData);
        updateIndicators(newData);
      }, 5000);
    } else {
      mockDataService.stopRealtime();
    }

    return () => {
      mockDataService.stopRealtime();
    };
  }, [isStreaming, updateIndicators]);

  // Update clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 10MB',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const getNextEntryTime = (): string => {
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    
    // Calculate next minute mark (entry time)
    let entryMinutes = minutes + 1;
    let entryHours = now.getHours();
    
    if (entryMinutes >= 60) {
      entryMinutes = 0;
      entryHours = (entryHours + 1) % 24;
    }
    
    return `${entryHours.toString().padStart(2, '0')}:${entryMinutes.toString().padStart(2, '0')}:00`;
  };

  const analyzeImage = async (base64Image: string) => {
    setAnalyzing(true);
    const entryTime = getNextEntryTime();
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-chart', {
        body: { imageBase64: base64Image }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const analysisResult: AnalysisResult = {
        signal: data.signal,
        confidence: data.confidence,
        analysis: data.analysis,
        timestamp: Date.now(),
        entryTime: entryTime
      };

      setResult(analysisResult);
      onAnalysisComplete(analysisResult);
      saveToHistory(analysisResult);

      toast({
        title: `Sinal ${data.signal} detectado`,
        description: `Entrada: ${entryTime} | Confiança: ${data.confidence}%`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Erro na análise',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const saveToHistory = (signal: AnalysisResult) => {
    const history = JSON.parse(localStorage.getItem('prisma-signals') || '[]');
    history.unshift({
      id: crypto.randomUUID(),
      signal: signal.signal,
      confidence: signal.confidence,
      timestamp: signal.timestamp,
      entryTime: signal.entryTime
    });
    const trimmed = history.slice(0, 50);
    localStorage.setItem('prisma-signals', JSON.stringify(trimmed));
    window.dispatchEvent(new Event('storage'));
  };

  const startStream = async () => {
    try {
      console.log('🎥 Starting live stream...');

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'never',
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints,
        audio: false,
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);

      // Handle stream end (user clicks "Stop sharing")
      stream.getVideoTracks()[0].onended = () => {
        stopStream();
        toast({
          title: 'Stream encerrado',
          description: 'A captura de tela foi finalizada'
        });
      };

      toast({
        title: 'Stream ao vivo iniciado',
        description: 'Capturando tela em tempo real'
      });

    } catch (error) {
      console.error('❌ Stream error:', error);
      let errorMessage = 'Não foi possível iniciar o stream';

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permissão de captura de tela negada.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Nenhuma tela disponível para captura.';
        }
      }

      toast({
        title: 'Erro ao iniciar stream',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    
    // Stop auto mode if streaming stops
    if (autoMode) {
      setAutoMode(false);
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
  };

  const captureFrame = async () => {
    if (!videoRef.current || !isStreaming) {
      toast({
        title: 'Stream não ativo',
        description: 'Inicie o stream antes de capturar',
        variant: 'destructive'
      });
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/png', 1.0);
    
    await analyzeImage(base64);
  };

  const toggleAutoMode = () => {
    if (!isStreaming) {
      toast({
        title: 'Stream necessário',
        description: 'Inicie o stream ao vivo primeiro',
        variant: 'destructive'
      });
      return;
    }

    const newAutoMode = !autoMode;
    setAutoMode(newAutoMode);

    if (newAutoMode) {
      toast({
        title: 'Modo automático ativado',
        description: 'Análises serão feitas a cada 30 segundos'
      });

      // Capture immediately first
      captureFrame();

      autoIntervalRef.current = setInterval(() => {
        if (!analyzing && isStreaming) {
          captureFrame();
        }
      }, 30000);
    } else {
      toast({
        title: 'Modo automático desativado',
        description: 'Análises automáticas foram pausadas'
      });

      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;

  return (
    <Card className="p-6 glass-effect border-white/10">
      <div className="space-y-6">
        {/* Header with Clock */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">PRISMA ORACLE IA</h2>
            <p className="text-sm text-muted-foreground">Captura ao vivo com análise em tempo real</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Horário Atual</p>
              <p className="text-2xl font-mono font-bold text-primary animate-pulse">
                {formatTime(currentTime)}
              </p>
            </div>

            <Button
              variant={autoMode ? 'destructive' : 'default'}
              onClick={toggleAutoMode}
              className="gap-2 rounded-full"
              disabled={!isStreaming}
            >
              {autoMode ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoMode ? 'Parar' : 'Auto'}
            </Button>
          </div>
        </div>

        {/* Main Content - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Video Stream */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live Video Stream Area */}
            <div className="relative aspect-video bg-gradient-to-br from-secondary/50 to-primary/20 rounded-2xl overflow-hidden border-2 border-dashed border-white/10">
              {isStreaming ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  {/* Live indicator */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-white">AO VIVO</span>
                  </div>
                  {/* Time overlay */}
                  <div className="absolute top-4 right-4 bg-black/70 px-3 py-1 rounded-lg">
                    <span className="text-sm font-mono text-white">{formatTime(currentTime)}</span>
                  </div>
                  {/* Next Entry Time */}
                  <div className="absolute bottom-4 right-4 bg-primary/90 px-4 py-2 rounded-lg">
                    <p className="text-[10px] text-white/80">PRÓXIMA ENTRADA</p>
                    <p className="text-lg font-mono font-bold text-white">{getNextEntryTime()}</p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">Stream não iniciado</p>
                    <p className="text-xs text-muted-foreground/60">
                      Clique em "Iniciar Stream" para captura ao vivo
                    </p>
                  </div>
                </div>
              )}

              {/* Hidden video ref for non-streaming mode */}
              {!isStreaming && <video ref={videoRef} className="hidden" />}

              {analyzing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-foreground font-medium">Analisando com IA...</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Gemini AI processando frame
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Trading Chart */}
            <div className="glass-effect rounded-xl p-4 border border-white/10">
              <TradingChart
                data={chartData}
                supports={indicators.supports}
                resistances={indicators.resistances}
                height={250}
              />
            </div>
          </div>

          {/* Right: Indicators Panel */}
          <div className="space-y-4">
            <TechnicalIndicators
              rsi={indicators.rsi}
              macd={indicators.macd}
              bollinger={indicators.bollinger}
              sma20={indicators.sma20}
              currentPrice={currentPrice}
              pattern={indicators.pattern}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {!isStreaming ? (
                <Button
                  onClick={startStream}
                  className="gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 col-span-2"
                >
                  <Video className="h-4 w-4" />
                  Iniciar Stream
                </Button>
              ) : (
                <Button
                  onClick={stopStream}
                  variant="destructive"
                  className="gap-2 rounded-full col-span-2"
                >
                  <VideoOff className="h-4 w-4" />
                  Parar Stream
                </Button>
              )}

              <Button
                onClick={captureFrame}
                disabled={analyzing || !isStreaming}
                className="gap-2 rounded-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-600"
              >
                <Camera className="h-4 w-4" />
                Capturar
              </Button>

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                variant="outline"
                className="gap-2 rounded-full border-white/20 hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Analysis Result */}
            {result && <SignalDisplay result={result} />}
          </div>
        </div>
      </div>
    </Card>
  );
}
