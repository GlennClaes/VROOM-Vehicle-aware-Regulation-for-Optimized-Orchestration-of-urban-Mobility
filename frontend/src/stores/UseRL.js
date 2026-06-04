// src/composables/UseRL.js
// Composable voor RL training + inference in het Vue dashboard

import { ref, onUnmounted } from 'vue'

const API = '/api/rl'

export function useRL() {

  // ── State ────────────────────────────────────────────────────────────────
  const trainingStatus  = ref(null)
  const inferenceStatus = ref(null)
  const models          = ref([])
  const error           = ref(null)
  let   eventSource     = null

  // ── Training ──────────────────────────────────────────────────────────────

  async function startTraining(episodes = 150, modelPath = null) {
    error.value = null
    try {
      const res = await fetch(`${API}/training/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ episodes, model_path: modelPath }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      startStream()   // begin live updates te ontvangen
      return await res.json()
    } catch (e) {
      error.value = e.message
    }
  }

  async function stopTraining() {
    try {
      await fetch(`${API}/training/stop`, { method: 'POST' })
      stopStream()
    } catch (e) {
      error.value = e.message
    }
  }

  // ── Inference ─────────────────────────────────────────────────────────────

  async function startInference(modelPath, maxSteps = 3600) {
    error.value = null
    try {
      const res = await fetch(`${API}/inference/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model_path: modelPath, max_steps: maxSteps }),
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      pollInference()
      return await res.json()
    } catch (e) {
      error.value = e.message
    }
  }

  async function stopInference() {
    try {
      await fetch(`${API}/inference/stop`, { method: 'POST' })
    } catch (e) {
      error.value = e.message
    }
  }

  async function fetchInferenceStatus() {
    const res = await fetch(`${API}/inference/status`)
    inferenceStatus.value = await res.json()
  }

  function pollInference() {
    const interval = setInterval(async () => {
      await fetchInferenceStatus()
      if (!inferenceStatus.value?.active) clearInterval(interval)
    }, 1000)
  }

  // ── Modellen ──────────────────────────────────────────────────────────────

  async function fetchModels() {
    const res  = await fetch(`${API}/models`)
    models.value = await res.json()
  }

  async function deleteModel(modelName) {
    await fetch(`${API}/models/${modelName}`, { method: 'DELETE' })
    await fetchModels()
  }

  // ── SSE Stream (live training updates) ───────────────────────────────────

  function startStream() {
    stopStream()   // sluit eventuele oude verbinding
    eventSource = new EventSource(`${API}/training/stream`)
    eventSource.onmessage = (e) => {
      trainingStatus.value = JSON.parse(e.data)
    }
    eventSource.onerror = () => {
      stopStream()
    }
  }

  function stopStream() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  // Sluit stream bij unmount van component
  onUnmounted(stopStream)

  return {
    // State
    trainingStatus,
    inferenceStatus,
    models,
    error,

    // Training
    startTraining,
    stopTraining,

    // Inference
    startInference,
    stopInference,
    fetchInferenceStatus,

    // Modellen
    fetchModels,
    deleteModel,
  }
}
