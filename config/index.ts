// Environment configuration
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get API URL from environment or use default
const getApiUrl = () => {
  // Check for environment variable
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;

  if (envApiUrl) {
    return envApiUrl;
  }

  // Default based on platform
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine
    return 'http://10.0.2.2:8000';
  } else if (Platform.OS === 'ios') {
    // iOS simulator can use localhost
    return 'http://localhost:8000';
  } else {
    // Web and other platforms
    return 'http://localhost:8000';
  }
};

export const config = {
  apiUrl: getApiUrl(),
  syncEnabled: true,
  syncInterval: 300000, // 5 minutes in milliseconds
  offlineTimeout: 30000, // 30 seconds
} as const;

export default config;
