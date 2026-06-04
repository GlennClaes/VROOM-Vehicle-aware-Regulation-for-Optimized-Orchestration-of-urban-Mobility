import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRL } from '../../stores/UseRL'

// Mock de globale fetch
global.fetch = vi.fn()

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('UseRL Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initialiseert met correcte beginwaarden', () => {
    const { trainingStatus, inferenceStatus, models, error } = useRL()
    expect(trainingStatus.value).toBe(null)
    expect(inferenceStatus.value).toBe(null)
    expect(models.value).toEqual([])
    expect(error.value).toBe(null)
  })

  it('haalt modellen succesvol op', async () => {
    const mockModels = ['model1.pt', 'model2.pt']
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels
    })

    const { fetchModels, models } = useRL()
    await fetchModels()

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/models'))
    expect(models.value).toEqual(mockModels)
  })

  it('zet een error als startTraining faalt', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Simulation Error' })
    })

    const { startTraining, error } = useRL()
    await startTraining(10)

    expect(error.value).toBe('Simulation Error')
  })
})
