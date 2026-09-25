import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  loanAmount: number;
  moratoriumMonths: number;
  emi: number;
  totalMonths: number;
}

export const RepaymentTimeline: React.FC<Props> = ({ loanAmount, moratoriumMonths, emi, totalMonths }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>लोन वापसी का समय</Text>
      
      <View style={styles.timeline}>
        {/* Loan Start */}
        <View style={styles.step}>
          <View style={[styles.dot, { backgroundColor: '#8e4e14' }]} />
          <View style={styles.content}>
            <Text style={styles.stepTitle}>लोन की शुरुआत</Text>
            <Text style={styles.stepDesc}>₹{loanAmount.toLocaleString('en-IN')} मिलेंगे</Text>
          </View>
        </View>
        
        {/* Line */}
        <View style={styles.line} />
        
        {/* Moratorium */}
        {moratoriumMonths > 0 && (
          <>
            <View style={styles.step}>
              <View style={[styles.dot, { backgroundColor: '#f4a261' }]} />
              <View style={styles.content}>
                <Text style={styles.stepTitle}>मोरेटोरियम ({moratoriumMonths} महीने)</Text>
                <Text style={styles.stepDesc}>इस दौरान EMI नहीं देनी होगी, व्यवसाय को जमने का समय मिलेगा।</Text>
              </View>
            </View>
            <View style={styles.line} />
          </>
        )}
        
        {/* EMI */}
        <View style={styles.step}>
          <View style={[styles.dot, { backgroundColor: '#3f6653' }]} />
          <View style={styles.content}>
            <Text style={styles.stepTitle}>किश्त (EMI) शुरू</Text>
            <Text style={styles.stepDesc}>₹{emi.toLocaleString('en-IN')} हर महीने ({totalMonths} महीनों तक)</Text>
          </View>
        </View>
        
        <View style={styles.line} />
        
        {/* End */}
        <View style={styles.step}>
          <View style={[styles.dot, { backgroundColor: '#2e7d32' }]} />
          <View style={styles.content}>
            <Text style={styles.stepTitle}>लोन पूरा</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', marginBottom: 20 },
  timeline: { marginLeft: 10 },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 16, height: 16, borderRadius: 8, marginTop: 4, zIndex: 2 },
  content: { marginLeft: 15, paddingBottom: 10 },
  stepTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  stepDesc: { fontSize: 14, color: '#666', marginTop: 2, flexWrap: 'wrap' },
  line: { width: 2, height: 40, backgroundColor: '#e0e0e0', marginLeft: 7, marginTop: -25, marginBottom: -5, zIndex: 1 }
});
