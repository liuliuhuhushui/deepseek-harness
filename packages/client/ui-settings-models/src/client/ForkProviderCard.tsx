/**
 * The add flow's fork card: a second account of an already-configured pi-ai
 * route. It mirrors the adopt flow's shape — the catalog already answers
 * endpoint, protocol, and models, so the card asks for exactly what is new:
 * the second account's key. The template facts are written into the new
 * route's profile unseen, because the route id the fork lands on is not one
 * the installed catalog can default. A route whose template cannot be
 * completed from the catalog or its stored profile falls back to the full
 * custom-provider card, prefilled with whatever was found.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { getPath } from '@deepseek-ai/dsh-client-schema-form'
import { catalogTemplate, suggestForkRoute, templateFromProfile } from './catalogTemplates.ts'
import type { ForkTemplate } from './catalogTemplates.ts'
import { apiKeyFailure } from './apiKey.ts'
import { CustomProviderCard } from './CustomProviderCard.tsx'
import { EditorFooter } from './EditorFooter.tsx'
import { deriveKeyRef, messageOf } from './store.ts'
import type { ProviderRow } from './store.ts'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/** Props of {@link ForkProviderCard}. */
export interface ForkProviderCardProps {
  /** The configured row being forked. */
  row: ProviderRow
  /** The owning namespace view: a declared route's template is read from it. */
  namespace: SettingsNamespaceView
  /** Route ids already present, for the suggestion and the card's own guard. */
  taken: readonly string[]
  /** Wire protocols the adapter can serve, in the order it reports them. */
  protocols: readonly string[]
  /** Revision of the `llm-pi-ai` user section this card opened at. */
  revision: number
  /** Wire faces the create writes through. */
  api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Disable writes (read-only settings provider). */
  readOnly: boolean
  /** Close the card; `changed` reports whether a provider was created. */
  onClose: (changed: boolean) => void
}

/** A fork only needs the light card when its template answers everything the profile must hold. */
function complete(template: ForkTemplate): boolean {
  return template.protocol.length > 0 && template.baseURL.length > 0 && template.models.length > 0
}

/**
 * Render the second-account card as a fork of {@link ForkProviderCardProps.row}.
 * @param props - the source row, template inputs, wire faces, and copy.
 * @returns the key-only card, or the full create card when the template has gaps.
 */
export function ForkProviderCard(props: ForkProviderCardProps): ReactNode {
  const { row, namespace, taken, protocols, api, t } = props
  // Computed once at mount: the source row and the taken set are the card's
  // own opening facts, exactly like the revision it writes against.
  const [template] = useState<ForkTemplate>(() => {
    const source = row.entry.provider
    const route = suggestForkRoute(source, taken)
    const facts = row.entry.declared === true
      ? templateFromProfile(getPath(namespace.value, row.entry.settingsPath))
      : catalogTemplate(source)
    return {
      route,
      displayName: `${row.entry.displayName} ${route.slice(source.length + 1)}`,
      baseURL: facts?.baseURL ?? '',
      protocol: facts?.protocol ?? '',
      models: facts?.models ?? [],
    }
  })
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  /** The profile write landed; a retry after that writes the credential alone. */
  const [committed, setCommitted] = useState(false)
  const disabled = props.readOnly || busy

  if (!complete(template)) {
    // The template has gaps only the user can answer (a route the installed
    // catalog does not describe): hand the draft to the full create card.
    return (
      <CustomProviderCard
        taken={taken}
        protocols={protocols}
        revision={props.revision}
        api={api}
        t={t}
        readOnly={props.readOnly}
        template={template}
        title={t('forkTitle').replace('{provider}', () => row.entry.displayName)}
        onClose={props.onClose}
      />
    )
  }

  const keyFailure = apiKeyFailure(keyDraft)
  // The typed key with paste whitespace removed. A blank field yields an empty
  // string, which the create path reads as "no key supplied" — the fork then
  // authenticates through the provider's own ambient discovery, like a route
  // declared with the key left blank.
  const keyValue = keyDraft.trim()

  /** Perform the create, returning a failure message or undefined. */
  const createOnce = async (): Promise<string | undefined> => {
    const keyRef = deriveKeyRef(template.route)
    if (!committed) {
      const profile = {
        displayName: template.displayName,
        ...keyValue.length === 0 ? {} : { apiKeyEnv: keyRef },
        api: template.protocol,
        baseURL: template.baseURL,
        models: template.models.map(model => ({ ...model })),
      }
      const response = await api.settings.mutate({
        ns: 'llm-pi-ai',
        ops: [{ op: 'set', path: ['providers', template.route], value: profile }],
        expectedRevision: props.revision,
      })
      if (!response.result.ok) return response.result.error.message
      setCommitted(true)
    }
    if (keyValue.length > 0) {
      const stored = await api.credentials.set({ ref: keyRef, value: keyValue })
      if (!stored.result.ok) return stored.result.error.message
    }
    return undefined
  }

  const create = async (): Promise<void> => {
    setBusy(true)
    setFailure(undefined)
    try {
      const outcome = await createOnce()
      if (outcome !== undefined) {
        setFailure(outcome)
        return
      }
      props.onClose(true)
    } catch (error) {
      setFailure(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles['editor']}>
      <div className={styles['editorHeader']}>
        <span className={styles['editorTitle']}>
          {t('forkTitle').replace('{provider}', () => row.entry.displayName)}
        </span>
      </div>
      <p className={styles['advancedHint']}>
        {t('forkBecomes').replace('{route}', () => template.route)}
      </p>
      <div className={styles['field']}>
        <span className={styles['fieldLabel']}>{t('keyInput')}</span>
        <input
          className={styles['input']}
          type="password"
          autoComplete="off"
          value={keyDraft}
          placeholder={t('keyPlaceholderNative')}
          aria-label={t('keyInput')}
          disabled={disabled}
          onChange={(event) => { setKeyDraft(event.target.value) }}
        />
        {keyFailure === undefined
          ? null
          : <p className={styles['error']}>{t(keyFailure === 'keyBlank' ? 'keyBlankNew' : keyFailure)}</p>}
      </div>
      {failure !== undefined ? <p className={styles['error']}>{failure}</p> : null}
      <EditorFooter
        t={t}
        busy={busy}
        submitDisabled={disabled || keyFailure !== undefined}
        submitLabel="create"
        submitBusyLabel="creating"
        onCancel={() => { props.onClose(committed) }}
        onSubmit={() => { void create() }}
      />
    </div>
  )
}
