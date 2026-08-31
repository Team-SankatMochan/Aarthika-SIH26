import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface RiskIndicatorProps {
  label: string;
  value: number; // 0-1
  showPercentage?: boolean;
}

function interpolateColor(value: number): string {
  // 0-0.4: green, 0.4-0.7: amber, 0.7-1.0: red
  if (value < 0.4) {
    // Green zone
    return '#639922';
  } else if (value < 0.7) {
    // Transition green -> amber
    const t = (value - 0.4) / 0.3;
    return `rgba(${99 + (239 - 99) * t}, ${153 + (159 - 153) * t}, ${34 + (39 - 34) * t}, 1)`;
  } else {
    // Transition amber -> red
    const t = (value - 0.7) / 0.3;
    return `rgba(${239 + (226 - 239) * t}, ${159 + (75 - 159) * t}, ${39 + (74 - 39) * t}, 1)`;
  }
}

export function RiskIndicator({ label, value, showPercentage = true }: RiskIndicatorProps) {
  const theme = useTheme();
  const clampedValue = Math.min(Math.max(value, 0), 1);
  const percentage = Math.round(clampedValue * 100);
  const barColor = interpolateColor(clampedValue);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText type="small">{label}</ThemedText>
        {showPercentage && (
          <ThemedText type="smallBold" style={{ color: barColor }}>
            {percentage}%
          </ThemedText>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.three,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
