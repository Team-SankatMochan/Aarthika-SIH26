import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { speak } from '../../services/tts';

interface Props {
  onStress?: (scenario: string | null) => void;
  baselineResult?: any;
  stressResult?: any;
  currentScenario?: string | null;
}

export const StressSimulatorGrid: React.FC<Props> = ({ onStress, baselineResult, stressResult, currentScenario }) => {
  const formatStatus = (s: string) => {
    if (s === 'READY_FOR_FINANCE_REVIEW') return 'Manageable';
    if (s === 'TIGHT_OR_REQUIRING_MORE_EQUITY') return 'Tight';
    return 'Risky';
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>अगर ऐसा हो जाए तो?</Text>
      <Text style={styles.subtitle}>मुश्किल परिस्थितियों में अपने प्लान की जांच करें:</Text>
      
      {currentScenario && baselineResult && stressResult && (
        <View style={styles.comparisonBox}>
           <View style={styles.compHeaderRow}>
             <Text style={styles.comparisonTitle}>
               {currentScenario === 'DEMAND_DROP_20' ? 'SALES -20%' : 'MATERIAL +20%'} IMPACT
             </Text>
             <TouchableOpacity onPress={() => {
               const condition = currentScenario === 'DEMAND_DROP_20' ? 'बिक्री 20 प्रतिशत कम होती है' : 'सामान 20 प्रतिशत महंगा होता है';
               const base = baselineResult.business_cash_available_for_debt_service || 0;
               const stressed = stressResult.business_cash_available_for_debt_service || 0;
               speak(`अगर ${condition}, तो EMI से पहले बचने वाली राशि ${base} रुपये से घटकर ${stressed} रुपये हो जाती है।`, 'hi');
             }}>
               <Text style={styles.speakBtn}>🔊 आसान भाषा में सुनें</Text>
             </TouchableOpacity>
           </View>
           <Text style={styles.compRow}>NORMAL: ₹{baselineResult.business_cash_available_for_debt_service?.toLocaleString('en-IN') || 0} remaining</Text>
           <Text style={styles.compRow}>STRESS: ₹{stressResult.business_cash_available_for_debt_service?.toLocaleString('en-IN') || 0} remaining</Text>
           <Text style={styles.compRow}>EMI: ₹{baselineResult.emi?.toLocaleString('en-IN') || 0}</Text>
           <Text style={styles.compRowBold}>स्थिति: {formatStatus(baselineResult.business_affordability_status)} → {formatStatus(stressResult.business_affordability_status)}</Text>
           
           <TouchableOpacity style={styles.resetBtn} onPress={() => onStress && onStress(null)}>
             <Text style={styles.resetBtnText}>नॉर्मल पर लौटें</Text>
           </TouchableOpacity>
        </View>
      )}

      <View style={styles.grid}>
        <TouchableOpacity 
           style={[styles.btn, currentScenario === 'DEMAND_DROP_20' && styles.activeBtn]} 
           onPress={() => onStress && onStress('DEMAND_DROP_20')}>
          <Text style={styles.icon}>📉</Text>
          <Text style={styles.btnText}>बिक्री 20% कम हो जाए</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
           style={[styles.btn, currentScenario === 'RAW_MATERIAL_UP_20' && styles.activeBtn]} 
           onPress={() => onStress && onStress('RAW_MATERIAL_UP_20')}>
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
  activeBtn: { borderColor: '#f4a261', backgroundColor: '#fff3e0', borderWidth: 2 },
  icon: { fontSize: 24, marginBottom: 5 },
  btnText: { fontSize: 14, fontWeight: 'bold', color: '#444', textAlign: 'center' },
  disabledBtn: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0', opacity: 0.7 },
  disabledText: { color: '#999' },
  comingSoon: { fontSize: 10, color: '#f57c00', marginTop: 5, fontWeight: 'bold' },
  comparisonBox: { backgroundColor: '#fdf3e8', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#f4a261' },
  compHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  comparisonTitle: { fontSize: 14, fontWeight: 'bold', color: '#ba1a1a', flex: 1 },
  speakBtn: { fontSize: 12, backgroundColor: '#f0f0f0', padding: 6, borderRadius: 8, color: '#333' },
  compRow: { fontSize: 14, color: '#444', marginBottom: 4 },
  compRowBold: { fontSize: 15, fontWeight: 'bold', color: '#333', marginTop: 8, marginBottom: 15 },
  resetBtn: { backgroundColor: '#3f6653', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  resetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
