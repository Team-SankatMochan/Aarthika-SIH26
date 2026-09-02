import { Platform } from 'react-native';

// API base URL - will be set based on environment
const getApiBaseUrl = () => {
  // Check if we are in development mode
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  if (isDev) {
    if (Platform.OS === 'web') {
      return 'http://localhost:8000';
    }
    // For mobile, you'll need to replace this with your machine's IP
    // Example: return 'http://192.168.1.100:8000';
    return 'http://localhost:8000';
  }
  // In production, use your deployed backend URL
  return 'https://your-backend-domain.com';
};

const API_BASE_URL = getApiBaseUrl();

// Generic fetch function with error handling
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

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

// Export all APIs
export const api = {
  business: businessApi,
  aiReports: aiReportsApi,
};

export default api;