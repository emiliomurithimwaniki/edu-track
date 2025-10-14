import axios from 'axios'

// Prefer relative base by default so requests go through Vite proxy (and ngrok single URL)
// You can still override with VITE_API_BASE_URL if needed.
export const backendBase = (import.meta.env.VITE_API_BASE_URL ?? '')
const api = axios.create({
  baseURL: backendBase.replace(/\/$/, '') + '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Simple refresh token flow on 401
let isRefreshing = false
let refreshPromise = null
const subscribers = []
function subscribeTokenRefresh(cb){ subscribers.push(cb) }
function onRefreshed(newToken){ while(subscribers.length) { const cb = subscribers.shift(); try{ cb(newToken) }catch{} } }

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err?.config
    const status = err?.response?.status
    const isAuthEndpoint = original?.url?.includes('/auth/token') || original?.url?.includes('/auth/me') || original?.url?.includes('/auth/token/refresh')
    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (!refresh) {
        try { localStorage.removeItem('access'); localStorage.removeItem('refresh') } catch {}
        if (typeof window !== 'undefined') window.location.href = '/login'
        return Promise.reject(err)
      }
      try {
        if (!isRefreshing) {
          isRefreshing = true
          refreshPromise = axios.post(backendBase.replace(/\/$/, '') + '/api/auth/token/refresh/', { refresh })
            .then(r => {
              const newAccess = r?.data?.access
              if (newAccess) { localStorage.setItem('access', newAccess) }
              isRefreshing = false; onRefreshed(newAccess); return newAccess
            })
            .catch(e => { isRefreshing = false; try { localStorage.removeItem('access'); localStorage.removeItem('refresh') } catch {}; if (typeof window !== 'undefined') window.location.href = '/login'; throw e })
        }
        const newTok = await refreshPromise
        return new Promise(resolve => {
          subscribeTokenRefresh((token)=>{
            original.headers = original.headers || {}
            if (token) original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      } catch (e) {
        return Promise.reject(e)
      }
    }
    return Promise.reject(err)
  }
)

export default api

// Convert possibly relative URLs (e.g., /media/...) to absolute URLs using backendBase
export function toAbsoluteUrl(url){
  try{
    if (!url) return ''
    // Already absolute (http/https/data)
    if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    const base = backendBase.replace(/\/$/, '')
    if (url.startsWith('/')) return base + url
    return base + '/' + url
  }catch{
    return url || ''
  }
}
