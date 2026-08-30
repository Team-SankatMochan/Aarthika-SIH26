import { Stack } from 'expo-router';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from '../../model';

export default function RootLayout() {
  return (
    <DatabaseProvider database={database}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Input' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      </Stack>
    </DatabaseProvider>
  );
}