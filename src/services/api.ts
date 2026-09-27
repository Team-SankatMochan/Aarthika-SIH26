import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * API base URL — resolved from environment or clearly marked unavailable.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL environment variable (production/staging)
 * 2. localhost:8000 for web dev
 * 3. null — remote backend unavailable, app continues with deterministic offline analytics
 */
export const getApiBaseUrl = (): string | null => {
  // Check for explicit env var first (works in dev and production)
  const envUrl = (typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_API_URL || process.env.API_URL) : undefined)
    ?? Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // In unit tests, do not use dev fallbacks if env is explicitly unset
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return null;
  }

  // Development fallback
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  if (isDev) {
    if (Platform.OS === 'android') {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:8000`;
      }
      return 'http://10.0.2.2:8000';
    }
    return 'http://localhost:8000';
  }

  // No API URL configured — backend is unavailable
  return null;
};

const API_BASE_URL = getApiBaseUrl();

/** Whether the remote backend API is configured and reachable. */
export const isBackendConfigured = API_BASE_URL !== null;

// Generic fetch function with error handling
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = getApiBaseUrl() || API_BASE_URL;
  if (!baseUrl) {
    throw new Error('BACKEND_UNAVAILABLE: No API URL configured. App is running in offline mode.');
  }

  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `API error: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Business API
export const businessApi = {
  createBusiness: (businessData: any) =>
    fetchApi('/businesses/', {
      method: 'POST',
      body: JSON.stringify(businessData),
    }),

  getBusiness: (businessId: string) =>
    fetchApi(`/businesses/${businessId}`),

  listBusinesses: () =>
    fetchApi('/businesses/'),

  createAssumption: (businessId: string, assumptionData: any) =>
    fetchApi(`/businesses/${businessId}/assumptions`, {
      method: 'POST',
      body: JSON.stringify(assumptionData),
    }),
};

// AI Reports API
export const aiReportsApi = {
  generateReport: (businessId: string) =>
    fetchApi('/ai/generate-report', {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId }),
    }),

  getReport: (businessId: string) =>
    fetchApi(`/ai/reports/${businessId}`),

  healthCheck: () =>
    fetchApi('/ai/health'),
};

// User API
export const userApi = {
  createUser: (userData: any) =>
    fetchApi('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getUser: (userId: string) =>
    fetchApi(`/users/${userId}`),

  listUsers: () =>
    fetchApi('/users'),
};

// Export all APIs
export const api = {
  business: businessApi,
  aiReports: aiReportsApi,
  users: userApi,
};

export default api;