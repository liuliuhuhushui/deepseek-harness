// @vitest-environment jsdom
/** Forking a configured provider route into a second account. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Schema from '@deepseek-ai/schemastery'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type { RpcResponse, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { ModelsSection } from '../src/client/ModelsSection.tsx'
import type { ModelsSectionInjected } from '../src/client/ModelsSection.tsx'
import { catalogTemplate, suggestForkRoute, templateFromProfile } from '../src/client/catalogTemplates.ts'
import { ModelsSettingsStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t: ModelsSectionInjected['t'] = key => en[key]

const PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages']

/** The pi-ai profile shape as the host serializes it, including the layer-1 fields. */
const PiAiConfig = Schema.object({
  providers: Schema.dict(Schema.object({
    apiKey: Schema.string().role('secret'),
    apiKeyEnv: Schema.string().role('credential-ref'),
    displayName: Schema.string(),
    api: Schema.union(PROTOCOLS),
    baseURL: Schema.string(),
    models: Schema.array(Schema.object({
      id: Schema.string().required(),
      name: Schema.string(),
      contextWindow: Schema.number(),
      maxTokens: Schema.number(),
    })),
    reasoning: Schema.union(['off', 'high']),
  })),
})

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `r-${nextRpc++}` as never, result: { ok: true, value } }
}

function piAiNamespace(
  providers: Record<string, unknown>,
  userProviders: Record<string, unknown> = providers,
): SettingsNamespaceView {
  return {
    ns: 'llm-pi-ai',
    schema: JSON.parse(JSON.stringify(PiAiConfig.toJSON())) as unknown,
    value: { providers },
    base: { providers: {} },
    user: { providers: userProviders },
    applies: 'live',
    secrets: [],
    revision: 3,
  }
}

function scriptedFace(options: {
  providers?: Record<string, unknown>
  /** Routes the adapter reports as hand-declared; the rest come back as shipped. */
  declaredRoutes?: readonly string[]
} = {}) {
  const providers = options.providers ?? {
    'kimi-coding': { apiKeyEnv: 'KIMI_CODING_API_KEY' },
  }
  const namespace = piAiNamespace(providers)
  const mutate: ReturnType<typeof vi.fn> = vi.fn(() => Promise.resolve(ok(namespace)))
  const set: ReturnType<typeof vi.fn> = vi.fn(() => Promise.resolve(ok({})))
  const face = {
    llm: {
      providers: vi.fn(() => Promise.resolve(ok({
        providers: Object.keys(providers).map(provider => ({
          provider,
          displayName: provider,
          settingsNs: 'llm-pi-ai',
          settingsPath: ['providers', provider],
          active: true,
          declared: options.declaredRoutes?.includes(provider) ?? false,
        })),
      }))),
      models: vi.fn(() => Promise.resolve(ok({ groups: [], failures: [] }))),
      discoverModels: vi.fn(() => Promise.resolve(ok({ models: [] }))),
    },
    settings: {
      describe: vi.fn(() => Promise.resolve(ok({ writable: true, namespaces: [namespace] }))),
      update: vi.fn(),
      replace: vi.fn(),
      mutate,
    },
    credentials: {
      describe: vi.fn((payload: { refs: string[] }) => Promise.resolve(ok({
        credentials: Object.fromEntries(payload.refs.map(ref => [ref, { configured: false, writable: true }])),
      }))),
      set,
      unset: vi.fn(),
    },
  }
  return { face, mutate, set, namespace }
}

type WireFace = ConstructorParameters<typeof ModelsSettingsStore>[0]

async function mountSection(options: Parameters<typeof scriptedFace>[0] = {}) {
  const scripted = scriptedFace(options)
  const controller = new ModelsSettingsStore(scripted.face as unknown as WireFace)
  await controller.load()
  const injected: ModelsSectionInjected = {
    controller,
    useSnapshot: bindSnapshotSelector(controller.store),
    api: scripted.face as never,
    t,
  }
  render(<ModelsSection {...injected} />)
  return { ...scripted, controller }
}

/** Open the add flow for the (single) addable row and wait for the fork card. */
async function openForkCard(title: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.add) }))
  await waitFor(() => { expect(screen.getByText(title)).toBeTruthy() })
}

describe('fork route suggestions', () => {
  it('names the first free suffixed route id', () => {
    expect(suggestForkRoute('kimi-coding', ['kimi-coding'])).toBe('kimi-coding-2')
    expect(suggestForkRoute('kimi-coding', ['kimi-coding', 'kimi-coding-2'])).toBe('kimi-coding-3')
    expect(suggestForkRoute('kimi-coding', [])).toBe('kimi-coding-2')
  })
})

describe('profile templates', () => {
  it('reads protocol, endpoint, and models out of a declared route’s profile', () => {
    const template = templateFromProfile({
      api: 'openai-completions',
      baseURL: 'https://gateway.acme.example/v1',
      models: [{ id: 'acme-large', contextWindow: 65_536, oddField: 'kept' }],
    })
    expect(template).toEqual({
      baseURL: 'https://gateway.acme.example/v1',
      protocol: 'openai-completions',
      models: [{ id: 'acme-large', contextWindow: 65_536, oddField: 'kept' }],
    })
  })

  it('answers nothing for a value that is no profile', () => {
    expect(templateFromProfile(undefined)).toBeUndefined()
    expect(templateFromProfile('nope')).toBeUndefined()
  })
})

describe('catalog templates', () => {
  it('reads the installed catalog’s facts for a shipped route', () => {
    const template = catalogTemplate('kimi-coding')
    expect(template?.protocol).toBe('anthropic-messages')
    expect(template?.baseURL).toBe('https://api.kimi.com/coding')
    const k3 = template?.models.find(model => model.id === 'k3')
    expect(k3).toBeDefined()
    expect((k3 as { input?: string[] } | undefined)?.input).toContain('image')
    // pi-ai's unoffered levels (null) drop out: a profile declares only the
    // offered ones, and resolution refuses a null-valued level other than off.
    expect((k3 as { reasoningEfforts?: Record<string, string | null> } | undefined)?.reasoningEfforts)
      .toEqual({ low: 'low', high: 'high', max: 'max' })
  })

  it('answers nothing for a provider the catalog does not ship', () => {
    expect(catalogTemplate('no-such-provider')).toBeUndefined()
  })
})

describe('fork a configured catalog route', () => {
  it('asks for only the key and writes the catalog’s answers unseen', async () => {
    const { mutate, set } = await mountSection()
    await openForkCard(en.forkTitle.replace('{provider}', 'kimi-coding'))

    // The light card mirrors the adopt flow: a key field and nothing else.
    expect(screen.getByText(en.forkBecomes.replace('{route}', 'kimi-coding-2'))).toBeTruthy()
    expect(screen.queryAllByLabelText(en.customRoute)).toHaveLength(0)
    expect(screen.queryAllByLabelText(en.baseUrl)).toHaveLength(0)
    expect(screen.queryAllByLabelText(en.customApi)).toHaveLength(0)
    const keyInput = screen.getByLabelText<HTMLInputElement>(en.keyInput)

    fireEvent.change(keyInput, { target: { value: 'second-account-key' } })
    fireEvent.click(screen.getByText(en.create))

    await waitFor(() => { expect(mutate).toHaveBeenCalled() })
    const call = mutate.mock.calls[0]?.[0] as { ops: { op: string; path: string[]; value: Record<string, unknown> }[] } | undefined
    expect(call?.ops[0]?.path).toEqual(['providers', 'kimi-coding-2'])
    expect(call?.ops[0]?.value.displayName).toBe('kimi-coding 2')
    expect(call?.ops[0]?.value.api).toBe('anthropic-messages')
    expect(call?.ops[0]?.value.baseURL).toBe('https://api.kimi.com/coding')
    expect(call?.ops[0]?.value.apiKeyEnv).toBe('KIMI_CODING_2_API_KEY')
    expect((call?.ops[0]?.value.models as { id: string }[]).some(model => model.id === 'k3')).toBe(true)
    await waitFor(() => { expect(set).toHaveBeenCalledWith({ ref: 'KIMI_CODING_2_API_KEY', value: 'second-account-key' }) })
  })
})

describe('fork a hand-declared route', () => {
  it('asks for only the key and copies the stored profile unseen', async () => {
    const { mutate } = await mountSection({
      providers: {
        'acme-gateway': {
          apiKeyEnv: 'ACME_GATEWAY_API_KEY',
          api: 'openai-completions',
          baseURL: 'https://gateway.acme.example/v1',
          models: [{ id: 'acme-large', contextWindow: 65_536 }],
        },
      },
      declaredRoutes: ['acme-gateway'],
    })
    await openForkCard(en.forkTitle.replace('{provider}', 'acme-gateway'))

    expect(screen.queryAllByLabelText(en.baseUrl)).toHaveLength(0)
    fireEvent.change(screen.getByLabelText(en.keyInput), { target: { value: 'acme-key-2' } })
    fireEvent.click(screen.getByText(en.create))

    await waitFor(() => { expect(mutate).toHaveBeenCalled() })
    const call = mutate.mock.calls[0]?.[0] as { ops: { op: string; path: string[]; value: Record<string, unknown> }[] } | undefined
    expect(call?.ops[0]?.path).toEqual(['providers', 'acme-gateway-2'])
    expect(call?.ops[0]?.value.api).toBe('openai-completions')
    expect(call?.ops[0]?.value.baseURL).toBe('https://gateway.acme.example/v1')
    expect(call?.ops[0]?.value.models).toEqual([{ id: 'acme-large', contextWindow: 65_536 }])
  })
})

describe('fork a route the catalog cannot size', () => {
  it('falls back to the full create card with whatever the template found', async () => {
    await mountSection({
      providers: { 'acme-shipped': { apiKeyEnv: 'ACME_SHIPPED_API_KEY' } },
    })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.add) }))
    const pick = await screen.findByLabelText<HTMLSelectElement>(en.provider)
    fireEvent.change(pick, { target: { value: 'acme-shipped' } })

    // No catalog data and no declared profile: the gaps are the user's to
    // answer, so the full create card opens with just the suggested identity.
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(en.customRoute).value).toBe('acme-shipped-2')
    })
    expect(screen.getByLabelText<HTMLInputElement>(en.baseUrl).value).toBe('')
    expect(screen.getByText(en.forkTitle.replace('{provider}', 'acme-shipped'))).toBeTruthy()
  })
})
