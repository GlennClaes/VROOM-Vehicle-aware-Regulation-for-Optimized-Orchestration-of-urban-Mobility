import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { simulationService } from '../../services/simulationService';

vi.mock('axios');

describe('simulationService', () => {
  it('saves a simulation result', async () => {
    const mockResult = { strategy: 'AI', scenario: 'normal', throughput: 100 };
    const mockResponse = { data: { id: 1, ...mockResult } };
    axios.post.mockResolvedValue(mockResponse);

    const result = await simulationService.saveResult(mockResult);

    expect(axios.post).toHaveBeenCalledWith('/api/simulations/', mockResult);
    expect(result).toEqual(mockResponse.data);
  });

  it('fetches simulation results', async () => {
    const mockResults = [{ id: 1, strategy: 'AI' }, { id: 2, strategy: 'Baseline' }];
    const mockResponse = { data: mockResults };
    axios.get.mockResolvedValue(mockResponse);

    const results = await simulationService.getResults();

    expect(axios.get).toHaveBeenCalledWith('/api/simulations/');
    expect(results).toEqual(mockResults);
  });

  it('deletes a simulation result', async () => {
    const mockId = 1;
    const mockResponse = { data: { status: 'success' } };
    axios.delete.mockResolvedValue(mockResponse);

    const result = await simulationService.deleteResult(mockId);

    expect(axios.delete).toHaveBeenCalledWith(`/api/simulations/${mockId}`);
    expect(result).toEqual(mockResponse.data);
  });
});
