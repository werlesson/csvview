<script setup lang="ts">
import Badge from '~/components/Badge.vue'

/**
 * Resumo de contagens da comparação (feature `file-comparison`, Fase 3, T04, UI-03).
 *
 * Presentacional: exibe as contagens de adicionados/removidos/alterados
 * recebidas via `counts`, no formato da Screen 5
 * (`+128 adicionadas · −54 removidas · ~312 alteradas`). `unchanged` nunca é
 * exibido (UI-03 AC) — só entra em `counts` para fechar a soma de RF-03.
 *
 * Ref de design: `.spec/init/design/README.md#screen-5--comparação-de-arquivos`.
 */
defineProps<{
  counts: {
    added: number
    removed: number
    changed: number
    unchanged: number
  }
}>()
</script>

<template>
  <div class="compare-summary" role="status">
    <Badge class="compare-summary__badge compare-summary__badge--added" variant="settled">
      +{{ counts.added }} adicionadas
    </Badge>
    <span class="compare-summary__sep" aria-hidden="true">·</span>
    <Badge class="compare-summary__badge compare-summary__badge--removed" variant="failed">
      −{{ counts.removed }} removidas
    </Badge>
    <span class="compare-summary__sep" aria-hidden="true">·</span>
    <Badge class="compare-summary__badge compare-summary__badge--changed" variant="pending">
      ~{{ counts.changed }} alteradas
    </Badge>
  </div>
</template>

<style scoped>
.compare-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.compare-summary__sep {
  color: var(--text-3);
}
</style>
