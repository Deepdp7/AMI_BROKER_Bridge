/**
 * Which tab the AI Assistant opens on. Kept apart from the page so the rest of the app can set
 * it (the "brief ready" notification) without loading the Assistant, which loads on demand.
 */
export type AssistantView = 'chat' | 'brief'

let savedView: AssistantView = 'chat'

export const getAssistantView = () => savedView

/** Open the Assistant page on a given tab (used by the "brief ready" notification). */
export function setAssistantView(v: AssistantView) {
  savedView = v
  window.dispatchEvent(new CustomEvent('assistant-view', { detail: v }))
}
