import axios from 'axios';

const API_URL = '/api';

export const simulationService = {
  async saveResult(result) {
    const response = await axios.post(`${API_URL}/simulations/`, result);
    return response.data;
  },

  async getResults() {
    const response = await axios.get(`${API_URL}/simulations/`);
    return response.data;
  },

  async deleteResult(id) {
    const response = await axios.delete(`${API_URL}/simulations/${id}`);
    return response.data;
  }
};
