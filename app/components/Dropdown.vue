<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Dropdown / popover do design system.
 *
 * Ref de design: `.spec/init/design/README.md`
 * (Biblioteca de componentes → Tabs & tooltip, dropdown).
 *
 * Base para o seletor de colunas do Viewer (US-2.3). Abre/fecha ao clicar no
 * gatilho, fecha ao clicar fora e é navegável por teclado (Escape fecha,
 * setas ↑/↓ movem o foco entre os itens do painel).
 *
 * Slots:
 * - `trigger` — conteúdo do botão gatilho (default: prop `label`)
 * - default — conteúdo do painel
 */
const props = withDefaults(
  defineProps<{
    label?: string
    disabled?: boolean
  }>(),
  {
    label: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
/** Lado de ancoragem do painel: alterna para a direita quando não há espaço
 *  à direita do gatilho, evitando que o painel vaze da viewport e gere scroll
 *  horizontal indesejado na página (relevante perto da borda direita). */
const align = ref<'left' | 'right'>('left')

function updateAlign(): void {
  if (!trigger.value || !panel.value) return
  const triggerRect = trigger.value.getBoundingClientRect()
  const panelWidth = panel.value.offsetWidth
  const margin = 8
  align.value =
    triggerRect.left + panelWidth + margin > window.innerWidth ? 'right' : 'left'
}

function focusableItems(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'))
}

async function openMenu(): Promise<void> {
  if (props.disabled || open.value) return
  open.value = true
  emit('open')
  await nextTick()
  updateAlign()
  focusableItems()[0]?.focus()
  window.addEventListener('resize', updateAlign)
}

function closeMenu(returnFocus = false): void {
  if (!open.value) return
  open.value = false
  emit('close')
  if (returnFocus) trigger.value?.focus()
  window.removeEventListener('resize', updateAlign)
}

function toggle(): void {
  if (open.value) closeMenu()
  else void openMenu()
}

function onDocumentPointerDown(event: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) {
    closeMenu()
  }
}

function moveFocus(step: 1 | -1): void {
  const items = focusableItems()
  if (items.length === 0) return
  const current = items.indexOf(document.activeElement as HTMLElement)
  const next = (current + step + items.length) % items.length
  items[next]?.focus()
}

function onPanelKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveFocus(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveFocus(-1)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', updateAlign)
})
</script>

<template>
  <div ref="root" class="dropdown">
    <button
      ref="trigger"
      type="button"
      class="dropdown__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
      @keydown.down.prevent="openMenu"
    >
      <slot name="trigger">{{ label }}</slot>
    </button>

    <Transition name="dropdown">
      <div
        v-show="open"
        ref="panel"
        class="dropdown__panel"
        :class="{ 'dropdown__panel--right': align === 'right' }"
        role="menu"
        @keydown.esc.prevent="closeMenu(true)"
        @keydown="onPanelKeydown"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-flex;
}

.dropdown__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.dropdown__trigger:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.dropdown__trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  min-width: 200px;
  /* Nunca ultrapassa a viewport, mesmo se `updateAlign` não alcançar a
     medição a tempo (ex.: primeiro paint) — trava o vazamento horizontal. */
  max-width: min(320px, calc(100vw - 24px));
  padding: 6px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* Perto da borda direita da viewport (UI-XX): ancora pela direita do gatilho
   em vez da esquerda, para o painel abrir "para dentro" da tela. */
.dropdown__panel--right {
  left: auto;
  right: 0;
}

/* Transição de abrir/fechar (RF-06c, UI-02): fade + leve translateY. */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition-duration: 0s;
  }
}
</style>
