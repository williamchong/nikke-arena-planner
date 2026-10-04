<script setup lang="ts">
/**
 * The game icons are white-on-transparent webp files. Drawing them as a CSS mask filled
 * with currentColor makes them follow the surrounding text colour, so they stay visible in
 * light mode and turn white on solid (selected) buttons.
 */
defineProps<{
  src: string
  /** Accessible name; omit when visible text next to the icon already says the same */
  label?: string
}>()
</script>

<template>
  <span
    class="inline-block shrink-0 bg-current mask-contain mask-center mask-no-repeat forced-colors:bg-[CanvasText]"
    :style="{ maskImage: `url('${src}')` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :title="label"
  />
</template>
