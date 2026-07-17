<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { isEmptyCell } from '~/services/columnStats'

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined
    /**
     * Coluna numérica (tipo inferido na Fase 5): alinha à direita em fonte
     * monoespaçada, mantendo os dígitos tabulares (US-2.1).
     */
    numeric?: boolean
    /**
     * Célula da coluna atualmente selecionada (painel de stats aberto): recebe um
     * leve realce de fundo, alinhado ao destaque do cabeçalho.
     */
    selected?: boolean
    /**
     * Nº de ocorrências do valor desta célula na sua coluna (RF-02): `> 1`
     * exibe o badge "dup ×N" ao lado do valor. `undefined`/`1` não exibe nada.
     */
    dupCount?: number
    /**
     * Coluna `number` com valor `< 0` (RF-04): aplica o mesmo tom de
     * `signClass`/`is-negative` (`StatsPanel.vue:92-93`) ao texto.
     */
    negative?: boolean
    /**
     * Coluna `date` cujo valor bruto não satisfaz `isDateValue` (RF-05): borda
     * `--warning` + ícone de alerta + prefixo "⚠ " ao valor, sem reformatar.
     */
    invalidDate?: boolean
    /**
     * Célula participa do fluxo de edição inline (`cell-editing`, RF-01).
     * Default `false` preserva o comportamento somente-leitura para qualquer
     * consumidor que não passe a prop.
     */
    editable?: boolean
    /** Célula está em modo de edição inline (estado controlado pelo pai, T03). */
    editing?: boolean
    /** Última confirmação de edição desta célula foi rejeitada por validação de tipo (RF-04, UI-02). */
    invalidEdit?: boolean
    /** Célula tem uma edição confirmada ainda não persistida via "Salvar nova versão" (UI-03). */
    dirty?: boolean
  }>(),
  {
    editable: false,
    editing: false,
    invalidEdit: false,
    dirty: false,
  },
)

const emit = defineEmits<{
  (e: 'edit-start'): void
  (e: 'edit-confirm', value: string): void
  (e: 'edit-cancel'): void
}>()

const isEmpty = computed(() => isEmptyCell(props.value))

const rawDisplay = computed(() => (isEmpty.value ? 'empty' : String(props.value)))

/** Valor exibido, com prefixo "⚠ " para data inválida (RF-05) — valor bruto, sem reformatação. */
const display = computed(() =>
  !isEmpty.value && props.invalidDate ? `⚠ ${rawDisplay.value}` : rawDisplay.value,
)

const showDupBadge = computed(() => (props.dupCount ?? 0) > 1)

/** Rascunho local do campo de edição, pré-preenchido com o valor atual ao entrar em edição (RF-01). */
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

/** Foco automático no campo ao entrar em edição, sem depender de interação do mouse (UI-01). */
watch(
  () => props.editing,
  (editing) => {
    if (!editing) return
    draft.value = isEmpty.value ? '' : String(props.value)
    void nextTick(() => inputRef.value?.focus())
  },
  { immediate: true },
)

/** Clique ou duplo-clique numa célula editável entra em modo de edição (RF-01). */
function onActivate(): void {
  if (!props.editable || props.editing) return
  emit('edit-start')
}

/** Enter/Tab confirmam a edição com o valor digitado (RF-02). */
function onConfirm(): void {
  emit('edit-confirm', draft.value)
}

/** Esc cancela a edição, restaura o valor original do campo e não confirma nada (RF-03). */
function onCancel(): void {
  draft.value = isEmpty.value ? '' : String(props.value)
  emit('edit-cancel')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    onConfirm()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
  }
}
</script>

<template>
  <td
    class="csv-cell"
    :class="[
      isEmpty ? 'csv-cell--empty' : '',
      numeric ? 'csv-cell--numeric' : '',
      selected ? 'csv-cell--selected' : '',
      negative ? 'csv-cell--negative' : '',
      invalidDate ? 'csv-cell--invalid-date' : '',
      editable ? 'csv-cell--editable' : '',
      editing ? 'csv-cell--editing' : '',
    ]"
    :title="isEmpty || editing ? undefined : display"
    @click="onActivate"
    @dblclick="onActivate"
  >
    <input
      v-if="editing"
      ref="inputRef"
      v-model="draft"
      type="text"
      class="csv-cell__input"
      @keydown="onKeydown"
      @click.stop
      @dblclick.stop
    >
    <template v-else>
      <span v-if="isEmpty" class="csv-cell__empty-label">{{ display }}</span>
      <template v-else>
        {{ display }}
        <span v-if="showDupBadge" class="csv-cell__dup-badge">dup ×{{ dupCount }}</span>
      </template>
    </template>

    <span v-if="dirty" class="csv-cell__dirty-indicator" title="Alteração pendente">●</span>

    <span v-if="invalidEdit" class="csv-cell__invalid-indicator" role="alert">
      <svg
        class="csv-cell__invalid-icon"
        viewBox="0 0 16 16"
        width="11"
        height="11"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 1.5 L15 14.5 H1 Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <line x1="8" y1="6.2" x2="8" y2="9.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="8" cy="12" r="0.8" fill="currentColor" />
      </svg>
      <span class="csv-cell__invalid-text">Inválido</span>
    </span>
  </td>
</template>

<style scoped>
/*
 * Célula de **linha única**: a virtualização assume altura fixa (ROW_HEIGHT em
 * ViewerTable), então o conteúdo NUNCA pode quebrar linha — senão a linha cresce
 * e se sobrepõe às vizinhas. Texto longo é truncado com reticências; o valor
 * completo fica no `title` (tooltip no hover).
 */
.csv-cell {
  position: relative;
  width: var(--col-w, 180px);
  height: 40px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  /* Divisor vertical entre colunas (cara de grade, fiel ao design). */
  border-right: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

/* Célula editável (cell-editing, RF-01): indica que clique/duplo-clique entra em edição. */
.csv-cell--editable {
  cursor: pointer;
}

/* Modo de edição (UI-01): remove o padding da célula para o input ocupar toda a área,
   com borda/fundo distintos do modo de leitura. */
.csv-cell--editing {
  padding: 0;
  overflow: visible;
}

.csv-cell__input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 0 11px;
  font: inherit;
  color: var(--text);
  background: var(--bg-1);
  border: 2px solid var(--accent);
  border-radius: 0;
  outline: none;
}

/* Indicador de "alteração pendente" (UI-03): restrito a esta célula, nunca à linha inteira. */
.csv-cell__dirty-indicator {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 8px;
  line-height: 1;
  color: var(--accent);
}

/* Indicador de erro de validação (UI-02): ícone + texto, não depende apenas de cor. */
.csv-cell__invalid-indicator {
  position: absolute;
  bottom: 2px;
  right: 4px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--bg-1);
  color: var(--error);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.6;
}

.csv-cell__invalid-icon {
  flex: none;
}

/* Célula vazia: padrão hachurado (listras diagonais) + rótulo "empty" (RF-01). */
.csv-cell--empty {
  position: relative;
  background-image: repeating-linear-gradient(
    45deg,
    var(--border) 0,
    var(--border) 4px,
    var(--bg-2) 4px,
    var(--bg-2) 8px
  );
}

.csv-cell__empty-label {
  display: block;
  width: 100%;
  text-align: center;
  color: var(--text-3);
  font-style: italic;
}

/* Colunas numéricas: alinhadas à direita, em mono com dígitos tabulares. */
.csv-cell--numeric {
  text-align: right;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

/* Coluna selecionada (painel de stats aberto): faixa accent na coluna, alinhada
   ao destaque do cabeçalho. */
.csv-cell--selected {
  background: var(--accent-soft);
  border-right-color: var(--accent);
  border-left: 1px solid var(--accent);
}

/* Célula numérica negativa (RF-04): mesmo tom de `signClass`/`is-negative`
   (`StatsPanel.vue:92-93,396-398`). */
.csv-cell--negative {
  color: var(--error);
}

/* Célula de data inválida (RF-05): borda laranja ao redor da célula; o ícone
   "⚠ " já vem embutido no valor exibido (ver `display`, sem reformatação). */
.csv-cell--invalid-date {
  box-shadow: inset 0 0 0 1px var(--warning);
}

/* Badge "dup ×N" (RF-02): ao lado do valor, cor accent (distinta de
   `--warning`/`--error`, já usados por data inválida/negativo). */
.csv-cell__dup-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-style: normal;
  color: var(--accent);
  background: var(--accent-soft);
  vertical-align: middle;
}
</style>
