import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  monthlyRevenue: number;
  totalExpenses: number;
  businessCash: number;
  breakEvenUnits: number;
}

export const RealityCheckCard: React.FC<Props> = ({ monthlyRevenue, totalExpenses, businessCash, breakEvenUnits }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>बिज़नेस की असली स्थिति (Reality Check)</Text>
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
          <Text style={styles.value}>{breakEvenUnits} units</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2, borderWidth: 1, borderColor: '#f4a261' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statBox: { flex: 1, marginRight: 10 },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: 'bold', color: '#333' }
});
