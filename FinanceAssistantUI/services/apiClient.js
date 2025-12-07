// FinanceAssistantUI/services/apiClient.js
let authToken = null;
let tokenRefreshHandler = null;

const normalizeBaseUrl = (url) => {
  if (!url) {
    return null;
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const API_BASE_URL = 'http://10.0.2.2:8000';

export const setAuthToken = (token) => {
  authToken = token;
};

export const clearAuthToken = () => {
  authToken = null;
};

export const setTokenRefreshHandler = (handler) => {
  tokenRefreshHandler = handler;
};

export const getApiBaseUrl = () => API_BASE_URL;

const buildUrl = (path) => {
  if (!path) {
    throw new Error('API path is required');
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not defined. Set it to your FastAPI endpoint.',
    );
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseResponse = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

export const apiRequest = async (path, options = {}) => {
  const url = buildUrl(path);
  let attemptedRefresh = false;

  while (true) {
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      if (
        response.status === 401 &&
        tokenRefreshHandler &&
        !attemptedRefresh
      ) {
        attemptedRefresh = true;
        try {
          await tokenRefreshHandler();
          continue; 
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError);
        }
      }

      const error = new Error(
        data?.detail ||
          data?.message ||
          `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }
};

export const api = {
  healthCheck: () => apiRequest('/'),
};

export const chatService = {
  sendQuery: async (question) => {
    const encodedQuestion = encodeURIComponent(question);
    return apiRequest(`/reports/simulate?user_question=${encodedQuestion}`, {
      method: 'POST',
    });
  },

  getFinancialHealth: async () => {
    return apiRequest('/reports/fhs');
  }
};

export const apiUpload = async (path, formData) => {
  const url = buildUrl(path);
  let attemptedRefresh = false;

  while (true) {
    const headers = {};

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401 && tokenRefreshHandler && !attemptedRefresh) {
        attemptedRefresh = true;
        try {
          await tokenRefreshHandler();
          continue; 
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError);
        }
      }

      const error = new Error(
        data?.detail || data?.message || `Upload failed with status ${response.status}`
      );
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }
};