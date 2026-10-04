import { useMediaQuery } from '@vueuse/core'

/**
 * Character pickers focus their search box on open, which on touch devices pops the
 * on-screen keyboard over the grid. Only do that when there's a mouse or trackpad.
 */
export function usePickerFocus() {
  const hasFinePointer = useMediaQuery('(pointer: fine)')

  // Pass as UModal's `content` prop: the dialog otherwise focuses its first input itself
  const pickerModalContent = {
    onOpenAutoFocus: (e: Event) => {
      if (hasFinePointer.value) return
      // Keep focus inside the dialog for assistive tech, just not on the input
      e.preventDefault()
      ;(e.target as HTMLElement | null)?.focus({ preventScroll: true })
    },
  }

  return { hasFinePointer, pickerModalContent }
}
