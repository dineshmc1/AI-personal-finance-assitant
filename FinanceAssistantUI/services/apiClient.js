// FinanceAssistantUI/services/apiClient.js
let authToken = null;
let tokenRefreshHandler = null;

const normalizeBaseUrl = (url) => {
  if (!url) {
    return null;
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

// 注意：如果是 Android 模拟器，确保环境变量是 http://10.0.2.2:8000
// const API_BASE_URL =
//   normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ??
//   'http://10.0.2.2:8000';
//   //'http://127.0.0.1:8000';

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
      // 处理 401 Token 过期，尝试自动刷新
      if (
        response.status === 401 &&
        tokenRefreshHandler &&
        !attemptedRefresh
      ) {
        attemptedRefresh = true;
        try {
          await tokenRefreshHandler();
          continue; // 刷新成功后重试请求
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

// 这里的 api 对象只保留了 healthCheck
export const api = {
  healthCheck: () => apiRequest('/'),
};

// === 新增：Chat 专用 API 服务 ===
export const chatService = {
  /**
   * 发送用户问题到 AI 模拟接口
   */
  sendQuery: async (question) => {
    // 注意：后端定义 user_question 是 Query Parameter，不是 Body
    const encodedQuestion = encodeURIComponent(question);
    return apiRequest(`/reports/simulate?user_question=${encodedQuestion}`, {
      method: 'POST',
      // 这里不需要 body，因为参数在 URL 里
    });
  },

  /**
   * (可选) 直接获取财务健康报告，如果用户点击了相关快捷建议
   */
  getFinancialHealth: async () => {
    return apiRequest('/reports/fhs');
  }
};

// === 新增：文件上传专用 API 函数 ===
export const apiUpload = async (path, formData) => {
  const url = buildUrl(path);
  let attemptedRefresh = false;

  while (true) {
    // 上传文件时，headers 中不要手动设 Content-Type，让 fetch 自动处理 boundary
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
      // 401 Token 过期处理逻辑
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