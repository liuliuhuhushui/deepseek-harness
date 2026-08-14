/**
 * Fork templates for declaring a second account of an already-configured
 * provider route. The add flow keeps configured pi-ai rows selectable, and
 * picking one opens the custom-provider card prefilled from one of two
 * sources: the installed pi-ai catalog for a shipped route, or the stored
 * profile itself for a hand-declared route, whose declaration is complete by
 * construction. The fork freezes a snapshot into the new route's profile —
 * exactly what typing the same values by hand would write.
 *
 * The catalog is read from pi-ai's per-provider data modules, statically —
 * the client module system materializes a plugin bundle through a synchronous
 * `require`, so a code-split chunk could never arrive here. What a fork
 * copies is a snapshot either way, so a build-time catalog is no staler than
 * the values the user would have typed from today's docs.
 *
 * @module dsh-client-ui-settings-models/catalogTemplates
 */

import { AMAZON_BEDROCK_MODELS } from '@earendil-works/pi-ai/providers/amazon-bedrock.models'
import { ANT_LING_MODELS } from '@earendil-works/pi-ai/providers/ant-ling.models'
import { ANTHROPIC_MODELS } from '@earendil-works/pi-ai/providers/anthropic.models'
import { AZURE_OPENAI_RESPONSES_MODELS } from '@earendil-works/pi-ai/providers/azure-openai-responses.models'
import { CEREBRAS_MODELS } from '@earendil-works/pi-ai/providers/cerebras.models'
import { CLOUDFLARE_AI_GATEWAY_MODELS } from '@earendil-works/pi-ai/providers/cloudflare-ai-gateway.models'
import { CLOUDFLARE_WORKERS_AI_MODELS } from '@earendil-works/pi-ai/providers/cloudflare-workers-ai.models'
import { DEEPSEEK_MODELS } from '@earendil-works/pi-ai/providers/deepseek.models'
import { FIREWORKS_MODELS } from '@earendil-works/pi-ai/providers/fireworks.models'
import { GITHUB_COPILOT_MODELS } from '@earendil-works/pi-ai/providers/github-copilot.models'
import { GOOGLE_MODELS } from '@earendil-works/pi-ai/providers/google.models'
import { GOOGLE_VERTEX_MODELS } from '@earendil-works/pi-ai/providers/google-vertex.models'
import { GROQ_MODELS } from '@earendil-works/pi-ai/providers/groq.models'
import { HUGGINGFACE_MODELS } from '@earendil-works/pi-ai/providers/huggingface.models'
import { KIMI_CODING_MODELS } from '@earendil-works/pi-ai/providers/kimi-coding.models'
import { MINIMAX_MODELS } from '@earendil-works/pi-ai/providers/minimax.models'
import { MINIMAX_CN_MODELS } from '@earendil-works/pi-ai/providers/minimax-cn.models'
import { MISTRAL_MODELS } from '@earendil-works/pi-ai/providers/mistral.models'
import { MOONSHOTAI_MODELS } from '@earendil-works/pi-ai/providers/moonshotai.models'
import { MOONSHOTAI_CN_MODELS } from '@earendil-works/pi-ai/providers/moonshotai-cn.models'
import { NVIDIA_MODELS } from '@earendil-works/pi-ai/providers/nvidia.models'
import { OPENAI_MODELS } from '@earendil-works/pi-ai/providers/openai.models'
import { OPENAI_CODEX_MODELS } from '@earendil-works/pi-ai/providers/openai-codex.models'
import { OPENCODE_MODELS } from '@earendil-works/pi-ai/providers/opencode.models'
import { OPENCODE_GO_MODELS } from '@earendil-works/pi-ai/providers/opencode-go.models'
import { OPENROUTER_MODELS } from '@earendil-works/pi-ai/providers/openrouter.models'
import { QWEN_TOKEN_PLAN_MODELS } from '@earendil-works/pi-ai/providers/qwen-token-plan.models'
import { QWEN_TOKEN_PLAN_CN_MODELS } from '@earendil-works/pi-ai/providers/qwen-token-plan-cn.models'
import { TOGETHER_MODELS } from '@earendil-works/pi-ai/providers/together.models'
import { VERCEL_AI_GATEWAY_MODELS } from '@earendil-works/pi-ai/providers/vercel-ai-gateway.models'
import { XAI_MODELS } from '@earendil-works/pi-ai/providers/xai.models'
import { XIAOMI_MODELS } from '@earendil-works/pi-ai/providers/xiaomi.models'
import { XIAOMI_TOKEN_PLAN_AMS_MODELS } from '@earendil-works/pi-ai/providers/xiaomi-token-plan-ams.models'
import { XIAOMI_TOKEN_PLAN_CN_MODELS } from '@earendil-works/pi-ai/providers/xiaomi-token-plan-cn.models'
import { XIAOMI_TOKEN_PLAN_SGP_MODELS } from '@earendil-works/pi-ai/providers/xiaomi-token-plan-sgp.models'
import { ZAI_MODELS } from '@earendil-works/pi-ai/providers/zai.models'
import { ZAI_CODING_CN_MODELS } from '@earendil-works/pi-ai/providers/zai-coding-cn.models'
import type { ModelDraft } from './ModelListEditor.tsx'

/** Everything the custom-provider card needs to open as a fork of another route. */
export interface ForkTemplate {
  /** Suggested route id (first free `<source>-N`). */
  route: string
  /** Suggested display name. */
  displayName: string
  /** Endpoint copied from the template source; empty when unknown. */
  baseURL: string
  /** Wire protocol copied from the template source; empty when unknown. */
  protocol: string
  /** Model rows copied from the template source. */
  models: ModelDraft[]
}

/**
 * The subset of a pi-ai catalog model entry the fork reads. Declared
 * structurally rather than imported so this module never drags pi-ai's type
 * surface into the client declarations.
 */
interface CatalogModelEntry {
  id?: unknown
  name?: unknown
  api?: unknown
  baseUrl?: unknown
  input?: unknown
  contextWindow?: unknown
  maxTokens?: unknown
  thinkingLevelMap?: unknown
}

/**
 * The installed pi-ai catalog, keyed by provider route. A provider missing
 * here is not an error: the fork falls back to the same blank fields the
 * plain custom flow opens with.
 */
const CATALOG_MODELS: Readonly<Record<string, Record<string, CatalogModelEntry>>> = {
  'amazon-bedrock': AMAZON_BEDROCK_MODELS,
  'ant-ling': ANT_LING_MODELS,
  'anthropic': ANTHROPIC_MODELS,
  'azure-openai-responses': AZURE_OPENAI_RESPONSES_MODELS,
  'cerebras': CEREBRAS_MODELS,
  'cloudflare-ai-gateway': CLOUDFLARE_AI_GATEWAY_MODELS,
  'cloudflare-workers-ai': CLOUDFLARE_WORKERS_AI_MODELS,
  'deepseek': DEEPSEEK_MODELS,
  'fireworks': FIREWORKS_MODELS,
  'github-copilot': GITHUB_COPILOT_MODELS,
  'google': GOOGLE_MODELS,
  'google-vertex': GOOGLE_VERTEX_MODELS,
  'groq': GROQ_MODELS,
  'huggingface': HUGGINGFACE_MODELS,
  'kimi-coding': KIMI_CODING_MODELS,
  'minimax': MINIMAX_MODELS,
  'minimax-cn': MINIMAX_CN_MODELS,
  'mistral': MISTRAL_MODELS,
  'moonshotai': MOONSHOTAI_MODELS,
  'moonshotai-cn': MOONSHOTAI_CN_MODELS,
  'nvidia': NVIDIA_MODELS,
  'openai': OPENAI_MODELS,
  'openai-codex': OPENAI_CODEX_MODELS,
  'opencode': OPENCODE_MODELS,
  'opencode-go': OPENCODE_GO_MODELS,
  'openrouter': OPENROUTER_MODELS,
  'qwen-token-plan': QWEN_TOKEN_PLAN_MODELS,
  'qwen-token-plan-cn': QWEN_TOKEN_PLAN_CN_MODELS,
  'together': TOGETHER_MODELS,
  'vercel-ai-gateway': VERCEL_AI_GATEWAY_MODELS,
  'xai': XAI_MODELS,
  'xiaomi': XIAOMI_MODELS,
  'xiaomi-token-plan-ams': XIAOMI_TOKEN_PLAN_AMS_MODELS,
  'xiaomi-token-plan-cn': XIAOMI_TOKEN_PLAN_CN_MODELS,
  'xiaomi-token-plan-sgp': XIAOMI_TOKEN_PLAN_SGP_MODELS,
  'zai': ZAI_MODELS,
  'zai-coding-cn': ZAI_CODING_CN_MODELS,
}

/**
 * The first `<source>-N` route id (N starting at 2) nobody owns. The source
 * id itself is always taken where a fork starts, so the count begins at 2.
 * @param source - the route being forked.
 * @param taken - every route id currently present.
 * @returns a free route id.
 */
export function suggestForkRoute(source: string, taken: readonly string[]): string {
  const owned = new Set(taken)
  for (let n = 2; ; n += 1) {
    const candidate = `${source}-${String(n)}`
    if (!owned.has(candidate)) return candidate
  }
}

/**
 * pi-ai marks an unoffered thinking level `null`, while a profile declares
 * only the offered levels (an absent key) — and resolution refuses a
 * null-valued level other than `off`. The fork therefore keeps just the
 * levels carrying a wire spelling; a model with none reasons nothing here.
 * @param map - pi-ai's `thinkingLevelMap` of one catalog model.
 * @returns the `reasoningEfforts` dict a profile may hold, or undefined when empty.
 */
function offeredLevels(map: Record<string, string | null>): Record<string, string | null> | undefined {
  const offered = Object.fromEntries(Object.entries(map).filter(([, value]) => value !== null))
  return Object.keys(offered).length > 0 ? offered : undefined
}

/** A catalog model entry as a model row, keeping only the fields a profile may hold. */
function catalogModelDraft(entry: CatalogModelEntry): ModelDraft | undefined {
  if (typeof entry.id !== 'string' || entry.id.length === 0) return undefined
  const modalities = Array.isArray(entry.input)
    ? entry.input.filter((value): value is string => typeof value === 'string')
    : []
  const reasoningEfforts = entry.thinkingLevelMap !== null && typeof entry.thinkingLevelMap === 'object'
    ? offeredLevels(entry.thinkingLevelMap as Record<string, string | null>)
    : undefined
  return {
    id: entry.id,
    ...typeof entry.name === 'string' && entry.name.length > 0 ? { name: entry.name } : {},
    ...typeof entry.contextWindow === 'number' ? { contextWindow: entry.contextWindow } : {},
    ...typeof entry.maxTokens === 'number' ? { maxTokens: entry.maxTokens } : {},
    ...modalities.length > 0 ? { input: [...modalities] } : {},
    ...reasoningEfforts === undefined ? {} : { reasoningEfforts },
  }
}

/**
 * Read the fork facts for a shipped catalog route: protocol, endpoint, and
 * its model rows. Returns `undefined` when the installed catalog ships no
 * data module for this provider — the caller then opens the card unfilled.
 * @param provider - the catalog route id being forked.
 * @returns the template facts, or undefined when the catalog has none.
 */
export function catalogTemplate(
  provider: string,
): Pick<ForkTemplate, 'baseURL' | 'protocol' | 'models'> | undefined {
  const record = CATALOG_MODELS[provider]
  if (record === undefined) return undefined
  const entries = Object.values(record)
  const models = entries.flatMap((entry) => {
    const draft = catalogModelDraft(entry)
    return draft === undefined ? [] : [draft]
  })
  const first = entries[0]
  return {
    baseURL: typeof first?.baseUrl === 'string' ? first.baseUrl : '',
    protocol: typeof first?.api === 'string' ? first.api : '',
    models,
  }
}

/**
 * Read the fork facts for a hand-declared route out of its stored profile: a
 * declared route's profile is its whole declaration, so protocol, endpoint,
 * and models are all present. Model rows keep every stored field — including
 * ones this page never edits — exactly as the editor cards preserve them.
 * @param profile - the settings value at the route's own path.
 * @returns the template facts, or undefined when the profile is unreadable.
 */
export function templateFromProfile(
  profile: unknown,
): Pick<ForkTemplate, 'baseURL' | 'protocol' | 'models'> | undefined {
  if (typeof profile !== 'object' || profile === null) return undefined
  const source = profile as { api?: unknown; baseURL?: unknown; models?: unknown }
  const models = Array.isArray(source.models)
    ? source.models.flatMap((entry): ModelDraft[] => {
      if (typeof entry !== 'object' || entry === null) return []
      const id = (entry as { id?: unknown }).id
      if (typeof id !== 'string' || id.length === 0) return []
      return [{ ...(entry as Record<string, unknown>), id }]
    })
    : []
  return {
    baseURL: typeof source.baseURL === 'string' ? source.baseURL : '',
    protocol: typeof source.api === 'string' ? source.api : '',
    models,
  }
}
