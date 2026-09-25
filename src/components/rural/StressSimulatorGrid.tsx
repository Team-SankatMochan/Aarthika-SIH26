import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  onStress?: (scenario: string) => void;
}

export const StressSimulatorGrid: React.FC<Props> = ({ onStress }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>अगर ऐसा हो जाए तो?</Text>
      <Text style={styles.subtitle}>मुश्किल परिस्थितियों में अपने प्लान की जांच करें:</Text>
      
      <View style={styles.grid}>
        <TouchableOpacity style={styles.btn} onPress={() => onStress && onStress('DEMAND_DROP_20')}>
          <Text style={styles.icon}>📉</Text>
          <Text style={styles.btnText}>बिक्री 20% कम हो जाए</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btn} onPress={() => onStress && onStress('RAW_MATERIAL_UP_20')}>
          <Text style={styles.icon}>💰</Text>
          <Text style={styles.btnText}>सामान 20% महंगा हो जाए</Text>
        </TouchableOpacity>
        
        <View style={[styles.btn, styles.disabledBtn]}>
          <Text style={[styles.icon, styles.disabledText]}>🌧</Text>
          <Text style={[styles.btnText, styles.disabledText]}>मौसम का बुरा असर</Text>
          <Text style={styles.comingSoon}>Coming after pilot</Text>
        </View>
        
        <View style={[styles.btn, styles.disabledBtn]}>
          <Text style={[styles.icon, styles.disabledText]}>🏪</Text>
          <Text style={[styles.btnText, styles.disabledText]}>नया कॉम्पटीटर आ जाए</Text>
          <Text style={styles.comingSoon}>Coming after pilot</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  btn: { width: '48%', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  icon: { fontSize: 24, marginBottom: 5 },
  btnText: { fontSize: 14, fontWeight: 'bold', color: '#444', textAlign: 'center' },
  disabledBtn: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0', opacity: 0.7 },
  disabledText: { color: '#999' },
  comingSoon: { fontSize: 10, color: '#f57c00', marginTop: 5, fontWeight: 'bold' }
});
