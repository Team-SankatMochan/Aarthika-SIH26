import { View, StyleSheet, Platform } from 'react-native';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface FinancialCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  variant?: 'default' | 'prominent';
}

export function FinancialCard({ title, value, subtitle, icon, variant = 'default' }: FinancialCardProps) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        {
          borderColor: theme.backgroundSelected,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          {title}
        </ThemedText>
        {icon && <ThemedText style={styles.icon}>{icon}</ThemedText>}
      </View>

      <ThemedText
        type={variant === 'prominent' ? 'subtitle' : 'title'}
        style={[styles.value, variant === 'prominent' && styles.prominentValue]}
      >
        {value}
      </ThemedText>

      {subtitle && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  icon: {
    fontSize: 20,
  },
  value: {
    marginBottom: Spacing.one,
  },
  prominentValue: {
    fontSize: 36,
    lineHeight: 44,
  },
  subtitle: {
    marginTop: Spacing.one,
  },
});
