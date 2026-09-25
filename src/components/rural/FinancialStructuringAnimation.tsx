import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  marginCapital: number;
  projectCost: number;
  loanAmount: number;
  raw90PercentLoan?: number;
  schemeLoanCap?: number;
}

export const FinancialStructuringAnimation: React.FC<Props> = ({ marginCapital, projectCost, loanAmount, raw90PercentLoan, schemeLoanCap }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1500);
    const t2 = setTimeout(() => setStep(2), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const isCapped = raw90PercentLoan && schemeLoanCap && raw90PercentLoan > schemeLoanCap;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Financial Structuring</Text>
      
      {/* Margin */}
      <View style={styles.row}>
        <Text style={styles.label}>Your Capital (10%)</Text>
        <Text style={styles.value}>{formatINR(marginCapital)}</Text>
      </View>
      <View style={[styles.bar, { width: '10%', backgroundColor: '#f4a261' }]} />

      {/* Project Cost */}
      {step >= 1 && (
        <>
          <View style={[styles.row, { marginTop: 20 }]}>
            <Text style={styles.label}>Total Project Cost (100%)</Text>
            <Text style={styles.value}>{formatINR(projectCost)}</Text>
          </View>
          <View style={[styles.bar, { width: '100%', backgroundColor: '#e9ecef' }]}>
            <View style={[styles.bar, { width: '10%', backgroundColor: '#f4a261', position: 'absolute' }]} />
          </View>
        </>
      )}

      {/* Loan */}
      {step >= 2 && (
        <>
          <View style={[styles.row, { marginTop: 20 }]}>
            <Text style={styles.label}>90% loan component:</Text>
            <Text style={[styles.value, { color: '#666' }]}>{formatINR(raw90PercentLoan || (projectCost * 0.9))}</Text>
          </View>
          
          {isCapped && (
            <View style={[styles.row, { marginTop: 5 }]}>
              <Text style={styles.label}>Scheme maximum:</Text>
              <Text style={[styles.value, { color: '#ba1a1a' }]}>{formatINR(schemeLoanCap)}</Text>
            </View>
          )}

          <View style={[styles.row, { marginTop: 5, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 }]}>
            <Text style={[styles.label, { fontWeight: 'bold' }]}>Maximum permitted loan:</Text>
            <Text style={[styles.value, { color: '#3f6653', fontSize: 20 }]}>{formatINR(loanAmount)}</Text>
          </View>
          
          <View style={[styles.bar, { width: '100%', backgroundColor: '#e9ecef', marginTop: 10 }]}>
            <View style={[styles.bar, { width: isCapped ? '80%' : '90%', backgroundColor: '#3f6653', position: 'absolute', right: 0 }]} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#8e4e14' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 16, color: '#555' },
  value: { fontSize: 18, fontWeight: 'bold' },
  bar: { height: 24, borderRadius: 12 }
});
