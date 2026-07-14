<script setup lang="ts">
import { ref } from 'vue'

/**
 * Tooltip do design system.
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Tabs & tooltip, dropdown).
 *
 * Aparece no hover/foco do gatilho e some ao sair/desfocar. O gatilho vai no
 * slot default; o conteúdo textual vem da prop `text` (ou do slot `content`).
 */
withDefaults(
  defineProps<{
    text?: string
  }>(),
  {
    text: '',
  },
)

const visible = ref(false)

function show(): void {
  visible.value = true
}

function hide(): void {
  visible.value = false
}
</script>

<template>
  <span
    class="tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <span
      v-show="visible"
      class="tooltip__bubble"
      role="tooltip"
    >
      <slot name="content">{{ text }}</slot>
    </span>
  </span>
</template>

<style scoped>
.tooltip {
  position: relative;
  display: inline-flex;
}

.tooltip__bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 6px 9px;
  background: var(--bg-1);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  font-family: var(--font);
  font-size: 12.5px;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
}
</style>
