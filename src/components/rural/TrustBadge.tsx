import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProvenanceSource } from '../../engine/CanonicalInputStore';

interface TrustBadgeProps {
  source: ProvenanceSource;
  size?: 'small' | 'medium';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ source, size = 'small' }) => {
  let icon = '';
  let label = '';
  let bgColor = '#f0f0f0';

  switch (source) {
    case 'USER_PROVIDED':
      icon = '✓'; label = 'आपने बताया'; bgColor = '#e8f5e9'; break;
    case 'USER_CONFIRMED_ESTIMATE':
      icon = '✓'; label = 'आपका अनुमान'; bgColor = '#e8f5e9'; break;
    case 'AARTHIKA_CALCULATION':
      icon = '🧮'; label = 'Aarthika Calculation'; bgColor = '#e3f2fd'; break;
    case 'GOVERNMENT_RULE':
      icon = '📜'; label = 'सरकारी नियम'; bgColor = '#fff3e0'; break;
    case 'MARKET_DATA':
      icon = '📊'; label = 'बाजार डेटा'; bgColor = '#f3e5f5'; break;
    case 'AI_EXPLANATION':
      icon = '🤖'; label = 'AI Explanation'; bgColor = '#e0f7fa'; break;
    case 'DEMO_DATA':
      icon = '⚠️'; label = 'DEMO DATA'; bgColor = '#ffebee'; break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      {size === 'medium' && <Text style={styles.label}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  icon: { fontSize: 12 },
  label: { fontSize: 10, marginLeft: 4, color: '#333' }
});
