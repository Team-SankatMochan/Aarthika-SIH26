import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalInputStore, useCanonicalInputs, ProvenanceSource } from '../engine/CanonicalInputStore';
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
const DEMO_POLICY = { minimum_required_dscr: 1.2, maximum_household_debt_ratio: 0.5 };

export default function RuralInterviewScreen() {
  const inputs = useCanonicalInputs();
  const [showStructuring, setShowStructuring] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [schemeResult, setSchemeResult] = useState<{ isMicroFinance: boolean }>({ isMicroFinance: false });
  
  const currentQuestion = engine.getNextQuestion(inputs);

  const handleConfirm = (value: any, source: string, derivation?: any) => {
    globalInputStore.set({
      field: currentQuestion!.canonical_field,
      value: value,
      source: source as ProvenanceSource,
      confirmed: true,
      derivation: derivation,
      timestamp: Date.now()
    });

    if (currentQuestion!.canonical_field === 'available_margin_capital') {
      setShowStructuring(true);
    }
  };

  const runCalculation = (stressMultiplier = 1) => {
    // Rely strictly on engine logic, not component rules
    const margin = Number(inputs.available_margin_capital) || 0;
    const projectCost = margin / 0.10; // SIH Challenge 10% logic
    
    // Engine Payload
    const engineInputs = {
      requested_loan_amount: projectCost * 0.9,
      annual_interest_rate_percent: 12,
      repayment_tenure_months: 36,
      moratorium_months: 3,
      monthly_units_sold: (Number(inputs.monthly_units_sold) || 0) * stressMultiplier,
      selling_price_per_unit: Number(inputs.selling_price_per_unit) || 0,
      variable_cost_per_unit: Number(inputs.variable_cost_per_unit) || 0,
      monthly_fixed_cost: 0,
      monthly_household_nonbusiness_income: 10000,
      monthly_household_essential_expenses: 5000,
      existing_monthly_household_debt_payments: 0
    };

    const result = calculateFinancialAssessment(engineInputs, DEMO_POLICY);
    setAssessmentResult(result);
    setSchemeResult({ isMicroFinance: projectCost <= 140000 });
  };

  const handleStressTrigger = () => {
    runCalculation(0.8); // 20% drop in sales
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

        {!assessmentResult ? (
          currentQuestion ? (
            <VoiceQuestionCard 
              key={currentQuestion.id}
              question={currentQuestion}
              onConfirm={handleConfirm}
            />
          ) : (
            <View style={styles.doneCard}>
              <Text style={styles.doneText}>जानकारी पूरी हुई!</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={() => runCalculation(1)}>
                <Text style={styles.doneBtnText}>परिणाम देखें</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.resultsContainer}>
            <HyperLocalMarketRadar />
            
            <SchemeRoutePath isMicroFinance={schemeResult.isMicroFinance} />
            
            {assessmentResult.emi && (
              <RepaymentTimeline 
                loanAmount={assessmentResult.capitalized_principal || 0} 
                moratoriumMonths={3} 
                emi={assessmentResult.emi} 
                totalMonths={36} 
              />
            )}

            <SafetySplitView 
              businessSafety={assessmentResult.business_affordability_status} 
              familySafety={assessmentResult.household_affordability_status} 
            />
            
            <StressSimulatorGrid onStress={handleStressTrigger} />
            
            <ReadinessResult status={assessmentResult.overall_readiness} />
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
