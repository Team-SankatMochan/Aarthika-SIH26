import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const StressSimulatorGrid: React.FC = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>अगर ऐसा हो जाए तो?</Text>
      <Text style={styles.subtitle}>मुश्किल परिस्थितियों में अपने प्लान की जांच करें:</Text>
      
      <View style={styles.grid}>
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.icon}>📉</Text>
          <Text style={styles.btnText}>बिक्री 20% कम हो जाए</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.icon}>💰</Text>
          <Text style={styles.btnText}>सामान 20% महंगा हो जाए</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.icon}>🌧</Text>
          <Text style={styles.btnText}>मौसम का बुरा असर</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.icon}>🏪</Text>
          <Text style={styles.btnText}>नया कॉम्पटीटर आ जाए</Text>
        </TouchableOpacity>
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
  btnText: { fontSize: 14, fontWeight: 'bold', color: '#444', textAlign: 'center' }
});
