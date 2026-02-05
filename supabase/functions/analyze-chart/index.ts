import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      throw new Error('No image data provided');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('🔍 Starting chart analysis with Gemini AI...');

    const prompt = `Você é a PRISMA ORACLE IA, um especialista em Price Action Raiz e análise técnica institucional.

Analise este gráfico de trading e forneça:

1. SINAL: Determine se é COMPRA, VENDA ou NEUTRO baseado em Price Action
2. CONFIANÇA: Nível de confiança (0-100%)
3. ANÁLISE: Explicação detalhada usando conceitos de Price Action Raiz
4. DADOS DO GRÁFICO: Extraia as últimas 20-30 velas visíveis no gráfico

ESTRATÉGIA DE ANÁLISE:
- Identifique fluxos de alta (N-Pivot: topos e fundos ascendentes)
- Identifique fluxos de baixa (N-Pivot: topos e fundos descendentes)
- PADRÃO W (Fundo Duplo): Reversão para COMPRA
- PADRÃO M (Topo Duplo): Reversão para VENDA
- Pavio longo inferior (rejeição de fundo) favorece COMPRA
- Pavio longo superior (rejeição de topo) favorece VENDA
- Lateralização (Trap Zone) = NEUTRO/AGUARDAR

EXTRAÇÃO DE DADOS:
Observe cuidadosamente cada vela no gráfico e extraia os valores aproximados de:
- open (abertura)
- high (máxima)
- low (mínima)  
- close (fechamento)

Use a escala de preço visível no lado direito do gráfico como referência.

Responda APENAS no formato JSON:
{
  "signal": "COMPRA|VENDA|NEUTRO",
  "confidence": 0-100,
  "analysis": "sua análise detalhada de Price Action aqui",
  "pattern": "nome do padrão identificado",
  "chartData": [
    {"open": 1.0850, "high": 1.0865, "low": 1.0845, "close": 1.0860},
    {"open": 1.0860, "high": 1.0870, "low": 1.0855, "close": 1.0862}
  ],
  "supports": [1.0800, 1.0750],
  "resistances": [1.0900, 1.0950]
}

IMPORTANTE: Extraia os dados das velas EXATAMENTE como aparecem no gráfico, da esquerda para a direita (mais antiga para mais recente).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    console.log('✅ Analysis response received');

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate response
    if (!['COMPRA', 'VENDA', 'NEUTRO'].includes(result.signal)) {
      result.signal = 'NEUTRO';
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
      result.confidence = 50;
    }

    // Process chart data with timestamps
    if (result.chartData && Array.isArray(result.chartData)) {
      const now = Math.floor(Date.now() / 1000);
      result.chartData = result.chartData.map((candle: any, index: number) => ({
        time: now - (result.chartData.length - 1 - index) * 60, // 1 minute candles
        open: candle.open || 0,
        high: candle.high || 0,
        low: candle.low || 0,
        close: candle.close || 0,
      }));
    } else {
      result.chartData = [];
    }

    console.log('✅ Analysis completed:', result.signal, result.confidence + '%, candles:', result.chartData?.length || 0);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
