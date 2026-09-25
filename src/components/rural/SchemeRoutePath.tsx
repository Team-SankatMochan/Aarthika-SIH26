import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  projectCost: number;
}

export const SchemeRoutePath: React.FC<Props> = ({ projectCost }) => {
  // Deterministic Routing matching Phase 2 P1
  const isMicroFinance = projectCost <= 140000;
  
  return (
    <View style={styles.card}>
      <Text style={styles.title}>सरकारी योजना मिलान</Text>
      <Text style={styles.subtitle}>आपकी जानकारी के आधार पर सही योजना:</Text>
      
      <View style={[styles.routeBox, isMicroFinance ? styles.activeRoute : styles.inactiveRoute]}>
        <Text style={styles.routeName}>Micro Finance Scheme</Text>
        <Text style={styles.routeDetail}>Project Cost up to ₹1.40L</Text>
        {isMicroFinance && <Text style={styles.matchedText}>✓ यह आपके लिए सही है</Text>}
      </View>

      <View style={[styles.routeBox, !isMicroFinance ? styles.activeRoute : styles.inactiveRoute]}>
        <Text style={styles.routeName}>Term Loan Scheme</Text>
        <Text style={styles.routeDetail}>Project Cost above ₹1.40L to ₹50L</Text>
        {!isMicroFinance && <Text style={styles.matchedText}>✓ यह आपके लिए सही है</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 15 },
  routeBox: { padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 2 },
  activeRoute: { borderColor: '#3f6653', backgroundColor: '#e8f5e9' },
  inactiveRoute: { borderColor: '#e0e0e0', backgroundColor: '#fafafa', opacity: 0.6 },
  routeName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  routeDetail: { fontSize: 14, color: '#666', marginTop: 4 },
  matchedText: { marginTop: 10, fontSize: 14, fontWeight: 'bold', color: '#2e7d32' }
});
