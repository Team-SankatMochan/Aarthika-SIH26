import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const ReadinessResult: React.FC<{ status: string }> = ({ status }) => {
  const getReadiness = () => {
    switch(status) {
      case 'READY_FOR_FINANCE_REVIEW':
        return { title: 'वित्तीय समीक्षा के लिए तैयार', icon: '✅', color: '#2e7d32', bg: '#e8f5e9', desc: 'आपका प्लान मजबूत है। आप लोन के लिए आवेदन कर सकते हैं।' };
      case 'TEST_FIRST':
        return { title: 'पहले छोटे स्तर पर आज़माएँ', icon: '🌱', color: '#f57f17', bg: '#fff3e0', desc: 'जोखिम कम करने के लिए शुरुआत कम पूंजी से करें।' };
      case 'HIGH_RISK':
        return { title: 'अभी जोखिम ज्यादा है', icon: '⚠️', color: '#c62828', bg: '#ffebee', desc: 'प्लान में बदलाव करें। EMI देना मुश्किल हो सकता है।' };
      default:
        return { title: 'जानकारी पूरी करें', icon: '📝', color: '#424242', bg: '#f5f5f5', desc: 'निर्णय के लिए और जानकारी चाहिए।' };
    }
  };

  const info = getReadiness();

  return (
    <View style={[styles.card, { backgroundColor: info.bg }]}>
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.title, { color: info.color }]}>{info.title}</Text>
      <Text style={styles.desc}>{info.desc}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 25, borderRadius: 16, marginVertical: 10, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  desc: { fontSize: 16, color: '#333', textAlign: 'center' }
});
