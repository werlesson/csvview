<script setup lang="ts">
import { ref } from 'vue'

/**
 * Dropzone da tela de Upload (Fase 6).
 *
 * Arrastar-e-soltar + seletor de arquivo (aceita `.csv`, `.tsv`, `.txt`),
 * com feedback visual de **drag-over**. Soltar um arquivo e clicar em
 * "Escolher arquivo" disparam o mesmo evento `select` (US-1.1).
 *
 * Ref de design: `.spec/init/design/README.md#screen-1--tela-inicial--upload`.
 */
withDefaults(
  defineProps<{
    /** Extensões aceitas, repassadas ao `<input type="file">`. */
    accept?: string
    /** Desabilita a interação durante uma abertura em andamento. */
    disabled?: boolean
  }>(),
  {
    accept: '.csv,.tsv,.txt',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'select', file: File): void
}>()

/** Referência ao `<input>` oculto acionado pelo botão "Escolher arquivo". */
const inputRef = ref<HTMLInputElement | null>(null)

/** Estado visual de drag-over (arquivo sobre a dropzone). */
const isDragOver = ref(false)

/** Emite o primeiro arquivo de uma seleção, ignorando seleções vazias. */
function emitFirst(files: FileList | null | undefined): void {
  const file = files?.[0]
  if (file) emit('select', file)
}

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = true
}

function onDragOver(event: DragEvent): void {
  // Necessário para que o `drop` seja aceito pelo navegador.
  event.preventDefault()
  isDragOver.value = true
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = false
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = false
  emitFirst(event.dataTransfer?.files)
}

function onPick(): void {
  inputRef.value?.click()
}

function onInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  emitFirst(input.files)
  // Zera o valor para permitir reselecionar o mesmo arquivo.
  input.value = ''
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--drag-over': isDragOver, 'dropzone--disabled': disabled }"
    :data-drag-over="isDragOver"
    role="button"
    tabindex="0"
    aria-label="Solte um arquivo CSV aqui ou escolha um arquivo"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="onPick"
    @keydown.enter.prevent="onPick"
    @keydown.space.prevent="onPick"
  >
    <svg
      class="dropzone__icon"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 15V4m0 0L8 8m4-4 4 4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <p class="dropzone__title">Arraste um arquivo CSV aqui</p>
    <p class="dropzone__hint">ou selecione</p>

    <button
      type="button"
      class="dropzone__button"
      :disabled="disabled"
      @click.stop="onPick"
    >
      Escolher arquivo
    </button>

    <p class="dropzone__formats">Formatos aceitos: .csv · .tsv · .txt</p>

    <input
      ref="inputRef"
      class="dropzone__input"
      type="file"
      :accept="accept"
      :disabled="disabled"
      @change="onInputChange"
    >
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 44px 24px;
  background: var(--bg-1);
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.dropzone:hover {
  border-color: var(--accent);
}

/* Estado drag-over — realce com accent enquanto o arquivo paira. */
.dropzone--drag-over {
  border-color: var(--accent);
  border-style: solid;
  background: var(--accent-soft);
}

.dropzone--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.dropzone__icon {
  color: var(--accent);
}

.dropzone__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}

.dropzone__hint {
  font-size: 14px;
  color: var(--text-2);
}

.dropzone__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  padding: 9px 14px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-fg);
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.dropzone__button:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.dropzone__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropzone__formats {
  margin-top: 4px;
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--text-3);
}

.dropzone__input {
  display: none;
}
</style>
