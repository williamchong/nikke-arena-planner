<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <footer class="border-t border-default py-6 text-center text-sm text-muted">
    <NuxtLink :to="localePath('/about')" class="hover:text-default">
      NIKKE Arena Planner
    </NuxtLink>
  </footer>
</template>
