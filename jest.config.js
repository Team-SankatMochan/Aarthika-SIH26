/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: ['node_modules/(?!(expo-crypto|@expo|@nozbe|expo|react-native|@react-native|react-native-web)/)'],
};
