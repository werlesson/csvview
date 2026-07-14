<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: string | number | null | undefined
}>()

const display = computed(() =>
  props.value === null || props.value === undefined || props.value === ''
    ? '—'
    : String(props.value),
)

const isEmpty = computed(() => display.value === '—')
</script>

<template>
  <td
    class="border-b border-gray-200 px-3 py-2 text-sm"
    :class="isEmpty ? 'text-gray-400 italic' : 'text-gray-800'"
  >
    {{ display }}
  </td>
</template>
