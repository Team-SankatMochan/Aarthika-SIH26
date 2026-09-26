import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { speak } from '../../services/tts';

interface Props {
  monthlyRevenue: number;
  totalExpenses: number;
  businessCash: number;
  breakEvenUnits: number | string;
}

export const RealityCheckCard: React.FC<Props> = ({ monthlyRevenue, totalExpenses, businessCash, breakEvenUnits }) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>बिज़नेस की असली स्थिति (Reality Check)</Text>
        <TouchableOpacity onPress={() => {
          const cashText = businessCash >= 0 ? `${businessCash} रुपये बचते हैं` : `${Math.abs(businessCash)} रुपये की कमी है`;
          speak(`आपकी अनुमानित मासिक बिक्री ${monthlyRevenue} रुपये है। खर्च निकालने के बाद EMI से पहले ${cashText}।`, 'hi');
        }}>
          <Text style={styles.speakBtn}>🔊 आसान भाषा में सुनें</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <View style={styles.statBox}>
          <Text style={styles.label}>महीने की बिक्री</Text>
          <Text style={styles.value}>₹{monthlyRevenue.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.label}>कुल खर्च</Text>
          <Text style={styles.value}>₹{totalExpenses.toLocaleString('en-IN')}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.statBox}>
          <Text style={styles.label}>EMI से पहले बचत</Text>
          <Text style={[styles.value, { color: businessCash >= 0 ? '#2e7d32' : '#ba1a1a' }]}>
            ₹{businessCash.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.label}>Break-even (कम से कम बिक्री)</Text>
          <Text style={styles.value}>{breakEvenUnits === 'NO_FINITE_BREAK_EVEN' ? 'N/A' : `${breakEvenUnits} units`}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2, borderWidth: 1, borderColor: '#f4a261' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', flex: 1 },
  speakBtn: { fontSize: 12, backgroundColor: '#f0f0f0', padding: 6, borderRadius: 8, color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statBox: { flex: 1, marginRight: 10 },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: 'bold', color: '#333' }
});
