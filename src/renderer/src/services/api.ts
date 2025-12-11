
import axios from 'axios';
import { session } from '../store/session';

const API_BASE_URL = 'http://127.0.0.1:3900/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (session.token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${session.token}`;
  }
  return config;
});

export default api;
