import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrustBadge } from './TrustBadge';

interface Props {
  location?: string;
}

export const HyperLocalMarketRadar: React.FC<Props> = ({ location }) => {
  const displayLocation = location || 'रामपुर';
  const showDemoData = process.env.EXPO_PUBLIC_ENABLE_SHOWCASE_DATA === 'true';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>आपके क्षेत्र में बाजार (5km)</Text>
        {showDemoData && <TrustBadge source="DEMO_DATA" />}
      </View>
      
      {showDemoData ? (
        <>
          <View style={styles.radarContainer}>
            {/* Mock Radar Visual */}
            <View style={styles.radarCircle}>
              <View style={styles.centerDot} />
              <Text style={[styles.pin, { top: 20, left: 50 }]}>🏘️ {displayLocation}</Text>
              <Text style={[styles.pin, { top: 80, left: 120 }]}>🏪 मंडी</Text>
              <Text style={[styles.pin, { top: 120, left: 20 }]}>🏭 कॉम्पटीटर</Text>
            </View>
          </View>
          <View style={styles.opportunityBox}>
            <Text style={styles.oppTitle}>🌱 मौका</Text>
            <Text style={styles.oppDesc}>इस क्षेत्र में ताजे दूध की मांग अधिक है लेकिन सप्लाई कम है।</Text>
          </View>
        </>
      ) : (
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>इस क्षेत्र के लिए verified market data अभी उपलब्ध नहीं है.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, marginVertical: 10, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#8e4e14' },
  radarContainer: { alignItems: 'center', marginVertical: 20 },
  radarCircle: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: '#beead1', backgroundColor: '#f0fff0', position: 'relative' },
  centerDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#8e4e14', position: 'absolute', top: 94, left: 94 },
  pin: { position: 'absolute', fontSize: 12, fontWeight: 'bold', backgroundColor: '#fff', padding: 2, borderRadius: 4 },
  opportunityBox: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 10 },
  oppTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 5 },
  oppDesc: { fontSize: 14, color: '#1b5e20' },
  noDataBox: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, alignItems: 'center' },
  noDataText: { fontSize: 14, color: '#666', fontStyle: 'italic' }
});
