import axios from 'axios'

const backendBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
const api = axios.create({
  baseURL: backendBase.replace(/\/$/, '') + '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
