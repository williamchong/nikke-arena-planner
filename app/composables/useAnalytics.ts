/**
 * Thin analytics wrapper — keeps event names greppable in one place.
 */
export function useAnalytics() {
  const { proxy: ga } = useScriptGoogleAnalytics()
  const { proxy: ph } = useScriptPostHog()

  function trackEvent(name: string, params?: Record<string, unknown>) {
    ga.gtag('event', name, params)
    ph.posthog.capture(name, params)
  }

  return { trackEvent }
}
