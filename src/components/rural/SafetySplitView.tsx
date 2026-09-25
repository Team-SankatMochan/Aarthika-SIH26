import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  businessSafety: string;
  familySafety: string;
}

export const SafetySplitView: React.FC<Props> = ({ businessSafety, familySafety }) => {
  const getStatus = (status: string) => {
    switch(status) {
      case 'READY_FOR_FINANCE_REVIEW': return { text: 'प्रबंधनीय ✓', color: '#2e7d32', bg: '#e8f5e9' }; // manageable
      case 'HIGH_RISK': return { text: 'दबाव/खतरा ⚠️', color: '#c62828', bg: '#ffebee' }; // pressure/risk
      case 'INSUFFICIENT_DATA': return { text: 'अधिक जानकारी चाहिए', color: '#f57f17', bg: '#fff3e0' }; // more info needed
      default: return { text: 'अज्ञात', color: '#666', bg: '#eee' };
    }
  };

  const biz = getStatus(businessSafety);
  const fam = getStatus(familySafety);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>सुरक्षा जांच</Text>
      
      <View style={styles.splitContainer}>
        <View style={styles.half}>
          <Text style={styles.label}>व्यवसाय</Text>
          <Text style={styles.desc}>क्या व्यवसाय EMI दे सकता है?</Text>
          <View style={[styles.badge, { backgroundColor: biz.bg }]}>
            <Text style={[styles.badgeText, { color: biz.color }]}>{biz.text}</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.half}>
          <Text style={styles.label}>परिवार</Text>
          <Text style={styles.desc}>क्या घर का खर्च चल पाएगा?</Text>
          <View style={[styles.badge, { backgroundColor: fam.bg }]}>
            <Text style={[styles.badgeText, { color: fam.color }]}>{fam.text}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', marginBottom: 15 },
  splitContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { flex: 1, paddingRight: 10 },
  divider: { width: 2, backgroundColor: '#eee', marginHorizontal: 10 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  desc: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 10 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 14, fontWeight: 'bold' }
});
