import axios from 'axios';
import { INFERENCE_SERVER_URL } from '../config/firebase';

const api = axios.create({
  baseURL: INFERENCE_SERVER_URL,
  timeout: 30000,
});

export const inferenceApi = {
  getStatus: () => api.get('/status'),
  startAnalysis: () => api.post('/start_analysis'),
  stopAnalysis: () => api.post('/stop_analysis'),
  getFinalResult: () => api.get('/final_result'),
  getSnapshot: () => api.get('/snapshot'),
  healthCheck: () => api.get('/health'),
};

export default api;
