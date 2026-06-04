import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// ── Mock EventSource ────────────────────────────────────────────────────────
class MockEventSource {
  constructor(url) {
    this.url = url
    this.onmessage = null
    this.onerror = null
    MockEventSource.instance = this
  }
  close() { this.closed = true }
}
MockEventSource.instance = null
global.EventSource = MockEventSource

// ── Helpers ─────────────────────────────────────────────────────────────────
function mockFetch(body, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(body),
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('useRL', () => {
  let useRL

  beforeEach(async () => {
    vi.resetModules()
    MockEventSource.instance = null
    const mod = await import('@/stores/UseRL.js')
    useRL = mod.useRL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── startTraining ──────────────────────────────────────────────────────────

  it('startTraining posts and starts stream on success', async () => {
    global.fetch = mockFetch({ status: 'started' })

    const { startTraining, error } = useRL()
    const result = await startTraining(100, 'model.pt')

    expect(fetch).toHaveBeenCalledWith(
      '/api/rl/training/start',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual({ status: 'started' })
    expect(error.value).toBeNull()
    expect(MockEventSource.instance).not.toBeNull()
  })

  it('startTraining sets error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ detail: 'Training mislukt' }),
    })

    const { startTraining, error } = useRL()
    await startTraining()

    expect(error.value).toBe('Training mislukt')
  })

  it('startTraining sets error on fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Netwerk fout'))

    const { startTraining, error } = useRL()
    await startTraining()

    expect(error.value).toBe('Netwerk fout')
  })

  it('startTraining uses default episodes when not provided', async () => {
    global.fetch = mockFetch({ status: 'started' })

    const { startTraining } = useRL()
    await startTraining()

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.episodes).toBe(150)
    expect(body.model_path).toBeNull()
  })

  // ── stopTraining ───────────────────────────────────────────────────────────

  it('stopTraining posts to stop endpoint', async () => {
    global.fetch = mockFetch({})

    const { stopTraining } = useRL()
    await stopTraining()

    expect(fetch).toHaveBeenCalledWith(
      '/api/rl/training/stop',
      { method: 'POST' }
    )
  })

  it('stopTraining sets error on exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Stop fout'))

    const { stopTraining, error } = useRL()
    await stopTraining()

    expect(error.value).toBe('Stop fout')
  })

  // ── startInference ─────────────────────────────────────────────────────────

  it('startInference posts and starts polling on success', async () => {
    vi.useFakeTimers()

    const inferenceStatusData = { active: false }
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: 'started' }) })
      .mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(inferenceStatusData) })

    const { startInference, error } = useRL()
    const result = await startInference('model.pt', 100)

    expect(result).toEqual({ status: 'started' })
    expect(error.value).toBeNull()

    vi.useRealTimers()
  })

  it('startInference sets error on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ detail: 'Inference fout' }),
    })

    const { startInference, error } = useRL()
    await startInference('model.pt')

    expect(error.value).toBe('Inference fout')
  })

  it('startInference sets error on fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Inference crash'))

    const { startInference, error } = useRL()
    await startInference('model.pt')

    expect(error.value).toBe('Inference crash')
  })

  // ── stopInference ──────────────────────────────────────────────────────────

  it('stopInference posts to stop endpoint', async () => {
    global.fetch = mockFetch({})

    const { stopInference } = useRL()
    await stopInference()

    expect(fetch).toHaveBeenCalledWith(
      '/api/rl/inference/stop',
      { method: 'POST' }
    )
  })

  it('stopInference sets error on exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Stop inference fout'))

    const { stopInference, error } = useRL()
    await stopInference()

    expect(error.value).toBe('Stop inference fout')
  })

  // ── fetchInferenceStatus ───────────────────────────────────────────────────

  it('fetchInferenceStatus updates inferenceStatus', async () => {
    global.fetch = mockFetch({ active: true, step: 42 })

    const { fetchInferenceStatus, inferenceStatus } = useRL()
    await fetchInferenceStatus()

    expect(inferenceStatus.value).toEqual({ active: true, step: 42 })
  })

  // ── fetchModels ────────────────────────────────────────────────────────────

  it('fetchModels updates models list', async () => {
    const modelList = [
      { name: 'model_a.pt', size_kb: 100, modified: '2024-01-01' },
      { name: 'model_b.pt', size_kb: 200, modified: '2024-01-02' },
    ]
    global.fetch = mockFetch(modelList)

    const { fetchModels, models } = useRL()
    await fetchModels()

    expect(models.value).toEqual(modelList)
  })

  // ── deleteModel ────────────────────────────────────────────────────────────

  it('deleteModel calls DELETE and refreshes models', async () => {
    const modelList = [{ name: 'model_b.pt', size_kb: 200, modified: '2024-01-02' }]
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(modelList) })

    const { deleteModel, models } = useRL()
    await deleteModel('model_a.pt')

    expect(fetch).toHaveBeenCalledWith(
      '/api/rl/models/model_a.pt',
      { method: 'DELETE' }
    )
    expect(models.value).toEqual(modelList)
  })

  // ── SSE Stream ─────────────────────────────────────────────────────────────

  it('startStream opens EventSource and handles messages', async () => {
    global.fetch = mockFetch({ status: 'started' })

    const { startTraining } = useRL()
    await startTraining(50)

    const es = MockEventSource.instance
    expect(es).not.toBeNull()
    expect(es.url).toBe('/api/rl/training/stream')

    es.onmessage({ data: JSON.stringify({ episode: 10, reward: 5.5 }) })
  })

  it('startStream closes on error', async () => {
    global.fetch = mockFetch({ status: 'started' })

    const { startTraining } = useRL()
    await startTraining(50)

    const es = MockEventSource.instance
    es.onerror()

    expect(es.closed).toBe(true)
  })

  it('startStream closes existing stream before opening new one', async () => {
    global.fetch = mockFetch({ status: 'started' })

    const { startTraining } = useRL()
    await startTraining(50)
    const first = MockEventSource.instance

    global.fetch = mockFetch({ status: 'started' })
    await startTraining(50)

    expect(first.closed).toBe(true)
    expect(MockEventSource.instance).not.toBe(first)
  })

  // ── pollInference ──────────────────────────────────────────────────────────

  it('pollInference stops when inference becomes inactive', async () => {
    vi.useFakeTimers()

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: 'started' }) })
      .mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ active: false }) })

    const { startInference, inferenceStatus } = useRL()
    await startInference('model.pt')

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(inferenceStatus.value).toEqual({ active: false })

    vi.useRealTimers()
  })
})
