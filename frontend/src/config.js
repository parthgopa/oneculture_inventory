// Toggle between local and ngrok
// export const API_BASE_URL = 'https://backend-inventory.oneculture.in'

export const API_BASE_URL = 'http://localhost:5000'
// export const API_BASE_URL = 'https://inventory.oneculture.in/api'


// export const API_BASE_URL = 'https://6910-2409-4090-1032-7005-248d-d666-7b94-c8e9.ngrok-free.app'

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

