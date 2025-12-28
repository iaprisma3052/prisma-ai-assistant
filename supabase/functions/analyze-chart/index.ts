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

    const prompt = `Você é um especialista em análise técnica de trading. Analise este gráfico de trading e forneça:

1. SINAL: Determine se é um sinal de COMPRA, VENDA ou NEUTRO
2. CONFIANÇA: Nível de confiança da análise (0-100%)
3. ANÁLISE: Explicação detalhada da análise técnica

Considere:
- Padrões de candlestick
- Suportes e resistências
- Médias móveis
- Volume
- Tendências de mercado
- Indicadores técnicos visíveis

Responda APENAS no formato JSON:
{
  "signal": "COMPRA|VENDA|NEUTRO",
  "confidence": 0-100,
  "analysis": "sua análise detalhada aqui"
}

Seja preciso, objetivo e baseie-se apenas no que você vê no gráfico.`;

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

    console.log('✅ Analysis completed successfully:', result.signal, result.confidence + '%');

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
