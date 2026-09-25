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
import { getSIHSchemeTerms, SIHSchemeResult, AARTHIKA_CALCULATION_POLICY } from '../engine/SIHSchemeRules';

const engine = new InterviewEngine();

export default function RuralInterviewScreen() {
  useCanonicalInputs(); // Just to trigger re-renders if needed
  const inputs = globalInputStore.getConfirmedValues();
  const [showStructuring, setShowStructuring] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [schemeResult, setSchemeResult] = useState<SIHSchemeResult | null>(null);
  
  const currentQuestion = engine.getNextQuestion(inputs);

  const handleConfirm = (value: any, source: string, derivation?: any) => {
    // If assisted estimate, use USER_CONFIRMED_ESTIMATE
    const provenance = source === 'DERIVED_FROM_USER_INPUT' ? 'USER_CONFIRMED_ESTIMATE' : source;
    globalInputStore.set({
      field: currentQuestion!.canonical_field,
      value: value,
      source: provenance as ProvenanceSource,
      confirmed: true,
      derivation: derivation,
      timestamp: Date.now()
    });

    if (currentQuestion!.canonical_field === 'available_margin_capital') {
      setShowStructuring(true);
    }
  };

  const runCalculation = (stressMultiplier = 1, stressScenario?: string) => {
    const margin = Number(inputs.available_margin_capital) || 0;
    const scheme = getSIHSchemeTerms(margin);
    setSchemeResult(scheme);
    
    if (scheme.isOutOfScope) {
      setAssessmentResult({ isOutOfScope: true });
      return;
    }

    // Engine Payload using ONLY confirmed inputs. Unconfirmed or missing remain undefined.
    const engineInputs: any = {
      requested_loan_amount: scheme.maxLoanComponent,
      annual_interest_rate_percent: scheme.interestRate,
      repayment_tenure_months: scheme.activeRepaymentMonths,
      moratorium_months: scheme.moratoriumMonths,
      scenario: stressScenario
    };

    if (inputs.monthly_units_sold !== undefined) {
      let val = Number(inputs.monthly_units_sold);
      if (stressScenario === 'DEMAND_DROP_20') val *= 0.80;
      engineInputs.monthly_units_sold = val;
    }
    if (inputs.selling_price_per_unit !== undefined) {
      engineInputs.selling_price_per_unit = Number(inputs.selling_price_per_unit);
    }
    if (inputs.variable_cost_per_unit !== undefined) {
      let val = Number(inputs.variable_cost_per_unit);
      if (stressScenario === 'RAW_MATERIAL_UP_20') val *= 1.20;
      engineInputs.variable_cost_per_unit = val;
    }
    
    // Fixed costs
    if (inputs.monthly_rent !== undefined) engineInputs.monthly_rent = Number(inputs.monthly_rent);
    if (inputs.monthly_labour_cost !== undefined) engineInputs.monthly_labour_cost = Number(inputs.monthly_labour_cost);
    if (inputs.monthly_transport_cost !== undefined) engineInputs.monthly_transport_cost = Number(inputs.monthly_transport_cost);
    if (inputs.monthly_other_fixed_cost !== undefined) engineInputs.monthly_other_fixed_cost = Number(inputs.monthly_other_fixed_cost);

    if (inputs.monthly_household_nonbusiness_income !== undefined) {
      engineInputs.monthly_household_nonbusiness_income = Number(inputs.monthly_household_nonbusiness_income);
    }
    if (inputs.monthly_household_essential_expenses !== undefined) {
      engineInputs.monthly_household_essential_expenses = Number(inputs.monthly_household_essential_expenses);
    }
    if (inputs.existing_monthly_household_debt_payments !== undefined) {
      engineInputs.existing_monthly_household_debt_payments = Number(inputs.existing_monthly_household_debt_payments);
    }

    const result = calculateFinancialAssessment(engineInputs, AARTHIKA_CALCULATION_POLICY);
    setAssessmentResult(result);
  };

  const handleStressTrigger = (scenario: string) => {
    runCalculation(1, scenario); 
  };

  const marginAmount = Number(inputs.available_margin_capital) || 0;
  const currentScheme = getSIHSchemeTerms(marginAmount);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Aarthika Saathi</Text>
          <TrustBadge source="DEMO_DATA" />
        </View>

        {showStructuring && inputs.available_margin_capital && (
          <FinancialStructuringAnimation 
            marginCapital={marginAmount} 
            projectCost={currentScheme.projectCost}
            loanAmount={currentScheme.maxLoanComponent}
            raw90PercentLoan={currentScheme.raw90PercentLoan}
            schemeLoanCap={currentScheme.schemeLoanCap}
          />
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
            <HyperLocalMarketRadar location={inputs.location} />
            
            {schemeResult && (
              <SchemeRoutePath schemeResult={schemeResult} />
            )}
            
            {!schemeResult?.isOutOfScope && assessmentResult.emi && schemeResult && (
              <RepaymentTimeline 
                loanAmount={assessmentResult.capitalized_principal || 0} 
                moratoriumMonths={schemeResult.moratoriumMonths} 
                emi={assessmentResult.emi} 
                totalMonths={schemeResult.totalTenureMonths} 
              />
            )}

            {!schemeResult?.isOutOfScope && (
              <>
                <SafetySplitView 
                  businessSafety={assessmentResult.business_affordability_status} 
                  familySafety={assessmentResult.household_affordability_status} 
                />
                
                <StressSimulatorGrid onStress={handleStressTrigger} />
                
                <ReadinessResult status={assessmentResult.overall_readiness} />
              </>
            )}
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
