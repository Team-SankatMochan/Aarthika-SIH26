import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { globalInputStore, useCanonicalInputs } from '../engine/CanonicalInputStore';
import { InterviewEngine } from '../engine/InterviewEngine';
import { VoiceQuestionCard } from '../components/rural/VoiceQuestionCard';
import { FinancialStructuringAnimation } from '../components/rural/FinancialStructuringAnimation';
import { TrustBadge } from '../components/rural/TrustBadge';
import { HyperLocalMarketRadar } from '../components/rural/HyperLocalMarketRadar';
import { SchemeRoutePath } from '../components/rural/SchemeRoutePath';
import { RepaymentTimeline } from '../components/rural/RepaymentTimeline';
import { SafetySplitView } from '../components/rural/SafetySplitView';
import { StressSimulatorGrid } from '../components/rural/StressSimulatorGrid';
import { ReadinessResult } from '../components/rural/ReadinessResult';
import { calculateFinancialAssessment } from '../../engine/financeCalculator';

const engine = new InterviewEngine();

export default function RuralInterviewScreen() {
  const inputs = useCanonicalInputs();
  const [showStructuring, setShowStructuring] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  
  const currentQuestion = engine.getNextQuestion(inputs);

  const handleConfirm = (value: any) => {
    globalInputStore.set({
      field: currentQuestion!.canonical_field,
      value: value,
      source: 'USER_PROVIDED',
      confirmed: true,
      timestamp: Date.now()
    });

    if (currentQuestion!.canonical_field === 'available_margin_capital') {
      setShowStructuring(true);
    }
  };

  const handleHelpEstimate = () => {
    // Basic stub for estimation flow
    alert('Assisted estimation will appear here.');
  };

  const runCalculation = () => {
    // In a real flow, we'd pass all inputs to calculateFinancialAssessment
    setIsCalculated(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Aarthika Saathi</Text>
          <TrustBadge source="DEMO_DATA" />
        </View>

        {showStructuring && inputs.available_margin_capital && (
          <FinancialStructuringAnimation marginCapital={Number(inputs.available_margin_capital)} />
        )}

        {!isCalculated ? (
          currentQuestion ? (
            <VoiceQuestionCard 
              key={currentQuestion.id}
              question={currentQuestion}
              onConfirm={handleConfirm}
              onHelpEstimate={handleHelpEstimate}
            />
          ) : (
            <View style={styles.doneCard}>
              <Text style={styles.doneText}>जानकारी पूरी हुई!</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={runCalculation}>
                <Text style={styles.doneBtnText}>परिणाम देखें</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.resultsContainer}>
            <HyperLocalMarketRadar />
            <SchemeRoutePath projectCost={Number(inputs.available_margin_capital) / 0.1} />
            <RepaymentTimeline loanAmount={Number(inputs.available_margin_capital) * 9} moratoriumMonths={3} emi={4500} totalMonths={36} />
            <SafetySplitView businessSafety="SAFE" familySafety="SAFE" />
            <StressSimulatorGrid />
            <ReadinessResult status="READY_FOR_FINANCE_REVIEW" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fbfaee' },
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#8e4e14' },
  doneCard: { padding: 30, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', marginTop: 20 },
  doneText: { fontSize: 22, fontWeight: 'bold', color: '#3f6653', marginBottom: 20 },
  doneBtn: { backgroundColor: '#8e4e14', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10 },
  doneBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  resultsContainer: { marginTop: 20 }
});
