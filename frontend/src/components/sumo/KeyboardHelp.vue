<template>
  <div>
    <button class="btn" :disabled="visible" @click="visible = true">Help</button>

    <div v-if="visible" class="dialog-backdrop" @click.self="visible = false">
      <div class="dialog">
        <div class="keyboard-help">
          <div>
            Keyboard Controls:
            <ul>
              <li><Key label="h" /> or <Key label="a" /> pan left</li>
              <li><Key label="j" /> or <Key label="s" /> pan backward</li>
              <li><Key label="k" /> or <Key label="w" /> pan forward</li>
              <li><Key label="l" /> or <Key label="d" /> pan right</li>
              <li><Key label="↑" /> rotate camera up</li>
              <li><Key label="↓" /> rotate camera down</li>
              <li><Key label="←" /> rotate camera left</li>
              <li><Key label="→" /> rotate camera right</li>
              <li><Key label="ctrl" /> + <Key label="↑" /> move camera up</li>
              <li><Key label="ctrl" /> + <Key label="↓" /> move camera down</li>
            </ul>
          </div>
          <div>
            Mouse Controls:
            <ul>
              <li>Left-drag to pan</li>
              <li>Right-drag to rotate</li>
              <li>Scroll to zoom</li>
            </ul>
          </div>
        </div>
        <button class="btn btn-primary" @click="visible = false">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)

// Sub-component defined inline
const Key = { props: ['label'], template: '<span class="key">{{ label }}</span>' }
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
}
</style>
