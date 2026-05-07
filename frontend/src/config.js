// Toggle between local and ngrok
// export const API_BASE_URL = 'http://localhost:5000'
export const API_BASE_URL = 'https://69c4-2409-4090-1032-7005-f534-44d6-146a-547e.ngrok-free.app'

// Default headers for all API calls (includes ngrok bypass)
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1'
}

// Helper function for API fetch with proper headers
export const apiFetch = (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  return fetch(url, {
    ...options,
    headers: {
      ...API_HEADERS,
      ...(options.headers || {})
    }
  })
}

