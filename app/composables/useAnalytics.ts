/**
 * Thin analytics wrapper — keeps event names greppable in one place.
 * Must be called during component/store setup so useGtag() has Nuxt context.
 */
export function useAnalytics() {
  const { gtag } = useGtag()

  function trackEvent(name: string, params?: Record<string, string | number>) {
    gtag('event', name, params)
  }

  return { trackEvent }
}
