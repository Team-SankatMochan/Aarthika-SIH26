import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { speak } from '../../services/tts';

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

  const handleSpeak = () => {
    let bizText = '';
    if (biz.text.includes('प्रबंधनीय')) bizText = 'व्यवसाय EMI संभाल सकता है';
    else if (biz.text.includes('अधिक जानकारी')) bizText = 'व्यवसाय के बारे में अधिक जानकारी चाहिए';
    else bizText = 'व्यवसाय पर EMI का दबाव पड़ सकता है';

    let famText = '';
    if (fam.text.includes('प्रबंधनीय')) famText = 'और घर के खर्च आराम से चल सकते हैं।';
    else if (fam.text.includes('अधिक जानकारी')) famText = 'और परिवार के खर्च के बारे में अधिक जानकारी चाहिए।';
    else famText = 'और घर के बजट पर दबाव पड़ सकता है।';
    
    speak(`${bizText}, ${famText}`, 'hi');
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>सुरक्षा जांच</Text>
        <TouchableOpacity onPress={handleSpeak}>
          <Text style={styles.speakBtn}>🔊 आसान भाषा में सुनें</Text>
        </TouchableOpacity>
      </View>
      
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', flex: 1 },
  speakBtn: { fontSize: 12, backgroundColor: '#f0f0f0', padding: 6, borderRadius: 8, color: '#333' },
  splitContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { flex: 1, paddingRight: 10 },
  divider: { width: 2, backgroundColor: '#eee', marginHorizontal: 10 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  desc: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 10 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 14, fontWeight: 'bold' }
});
