import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/* Modellwahl: gemessen am selben Datensatz mit identischem Prompt. Haiku 4.5 hielt
   die Sprachregeln nicht ein. Sonnet 5 war sauber, blieb aber beim Vorlesen der
   Kennzahlen. Opus 5 fand als einziges Muster, die in den Rohdaten stehen, aber in
   keiner Kennzahl -- etwa dieselbe Caption dreimal fast wortgleich. */
export const KI_MODELL = 'claude-opus-5'
export const PREIS_INPUT_PER_MTOK = 5.00
export const PREIS_OUTPUT_PER_MTOK = 25.00

export const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok' }

export const deZahl = (n: number | null | undefined, k = 0) =>
  n === null || n === undefined ? '—'
    : Number(n).toLocaleString('de-DE', { minimumFractionDigits: k, maximumFractionDigits: k })

export const deDatum = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '?'

export async function logAIUsage(params: { feature: string; tokensInput: number; tokensOutput: number; userId: string | null; metadata: Record<string, any> }): Promise<void> {
  const tokensTotal = params.tokensInput + params.tokensOutput
  const costUsd = parseFloat(((params.tokensInput / 1_000_000 * PREIS_INPUT_PER_MTOK) + (params.tokensOutput / 1_000_000 * PREIS_OUTPUT_PER_MTOK)).toFixed(6))
  try {
    await supabase.from('ai_usage_log').insert({
      feature: params.feature, provider: 'Anthropic', model: KI_MODELL,
      tokens_input: params.tokensInput, tokens_output: params.tokensOutput, tokens_total: tokensTotal,
      cost_usd: costUsd, user_id: params.userId, metadata: params.metadata
    })
  } catch (e: any) { console.error('ai_usage_log insert error:', e.message) }
}
