/**
 * Thin analytics wrapper — keeps event names greppable in one place.
 */
type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

export function useAnalytics() {
  const { proxy: ga } = useScriptGoogleAnalytics()
  const { proxy: ph } = useScriptPostHog()

  function trackEvent(name: string, params?: AnalyticsParams) {
    ga.gtag('event', name, params)
    ph.posthog.capture(name, params)
  }

  function registerSuperProperties(params: AnalyticsParams) {
    ph.posthog.register(params)
  }

  return { trackEvent, registerSuperProperties }
}
