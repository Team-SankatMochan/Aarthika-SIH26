import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { globalInputStore, useCanonicalInputs, ProvenanceSource } from '../engine/CanonicalInputStore';
import { InterviewEngine } from '../engine/InterviewEngine';
import { VoiceQuestionCard } from '../components/rural/VoiceQuestionCard';
import { FinancialStructuringAnimation } from '../components/rural/FinancialStructuringAnimation';

import { HyperLocalMarketRadar } from '../components/rural/HyperLocalMarketRadar';
import { SchemeRoutePath } from '../components/rural/SchemeRoutePath';
import { RepaymentTimeline } from '../components/rural/RepaymentTimeline';
import { RealityCheckCard } from '../components/rural/RealityCheckCard';
import { SafetySplitView } from '../components/rural/SafetySplitView';
import { StressSimulatorGrid } from '../components/rural/StressSimulatorGrid';
import { ReadinessResult } from '../components/rural/ReadinessResult';
import { calculateFinancialAssessment } from '../../engine/financeCalculator';
import { getSIHSchemeTerms, SIHSchemeResult, AARTHIKA_CALCULATION_POLICY } from '../engine/SIHSchemeRules';
import { hydrateCanonicalInputsFromWatermelon, persistCanonicalInputsToWatermelon } from '../services/canonicalPersistence';

const engine = new InterviewEngine();

export default function RuralInterviewScreen() {
  useCanonicalInputs(); // Just to trigger re-renders if needed
  const inputs = globalInputStore.getConfirmedValues();
  const [showStructuring, setShowStructuring] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [baselineResult, setBaselineResult] = useState<any>(null);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [schemeResult, setSchemeResult] = useState<SIHSchemeResult | null>(null);
  const [userProfile, setUserProfile] = useState<{ name?: string; location?: string; business?: string } | null>(null);
  const [profileSource, setProfileSource] = useState<'DATABASE' | 'PROFILE' | null>(null);

  // Pre-populate user profile from database/AsyncStorage so Aarthika never re-asks for location or business!
  useEffect(() => {
    (async () => {
      try {
        // 1. First attempt to hydrate confirmed values from local WatermelonDB schema v5
        const dbHydrated = await hydrateCanonicalInputsFromWatermelon();
        if (dbHydrated.hasConfirmedInputs) {
          setProfileSource('DATABASE');
          if (dbHydrated.businessCategory || dbHydrated.businessName) {
            setUserProfile({
              business: dbHydrated.businessCategory || dbHydrated.businessName,
              location: dbHydrated.location || 'स्थानीय',
            });
          }
        }

        // 2. Load stored profile / user fallback
        const storedUser = await AsyncStorage.getItem('@user');
        const storedProfile = await AsyncStorage.getItem('@touchless_profile');
        const storedPlan = await AsyncStorage.getItem('@business_plan');
        const userObj = storedUser ? JSON.parse(storedUser) : null;
        const profObj = storedProfile ? JSON.parse(storedProfile) : null;
        const planObj = storedPlan ? JSON.parse(storedPlan) : null;

        const userName = userObj?.fullName || userObj?.firstName || profObj?.name;
        const location = userObj?.village || userObj?.district || profObj?.place;
        const business = userObj?.occupation || userObj?.interestedSector || profObj?.occupation || planObj?.title || planObj?.sector;

        if (userName || location || business) {
          setUserProfile((prev) => ({
            name: userName || prev?.name,
            location: location || prev?.location,
            business: business || prev?.business,
          }));
          if (!dbHydrated.hasConfirmedInputs) {
            setProfileSource('PROFILE');
          }
        }

        // Pre-populate canonical store so InterviewEngine skips questions already in database!
        if (location && globalInputStore.get('location')?.value === undefined) {
          globalInputStore.set({
            field: 'location',
            value: location,
            source: 'USER_PROVIDED',
            confirmed: true,
            timestamp: Date.now(),
          });
        }

        if (business && globalInputStore.get('business_category')?.value === undefined) {
          globalInputStore.set({
            field: 'business_category',
            value: business,
            source: 'USER_PROVIDED',
            confirmed: true,
            timestamp: Date.now(),
          });
        }

        if (planObj) {
          const isConfirmed = planObj.presetSource === 'USER_PROVIDED' || planObj.presetSource === 'USER_CONFIRMED_ESTIMATE' || planObj.presetSource === 'ENTREPRENEUR';
          const planSource = planObj.presetSource || 'SUGGESTED_ESTIMATE';

          if (planObj.availableMarginCapital != null && planObj.availableMarginCapital !== '' && globalInputStore.get('available_margin_capital')?.value === undefined) {
            globalInputStore.set({
              field: 'available_margin_capital',
              value: Number(planObj.availableMarginCapital),
              source: planSource,
              confirmed: isConfirmed,
              timestamp: Date.now(),
            });
          }
          if (planObj.salesPerMonth != null && planObj.salesPerMonth !== '' && globalInputStore.get('monthly_units_sold')?.value === undefined) {
            globalInputStore.set({
              field: 'monthly_units_sold',
              value: Number(planObj.salesPerMonth),
              source: planSource,
              confirmed: isConfirmed,
              timestamp: Date.now(),
            });
          }
          if (planObj.pricePerUnit != null && planObj.pricePerUnit !== '' && globalInputStore.get('selling_price_per_unit')?.value === undefined) {
            globalInputStore.set({
              field: 'selling_price_per_unit',
              value: Number(planObj.pricePerUnit),
              source: planSource,
              confirmed: isConfirmed,
              timestamp: Date.now(),
            });
          }
          if (planObj.costPerUnit != null && planObj.costPerUnit !== '' && globalInputStore.get('variable_cost_per_unit')?.value === undefined) {
            globalInputStore.set({
              field: 'variable_cost_per_unit',
              value: Number(planObj.costPerUnit),
              source: planSource,
              confirmed: isConfirmed,
              timestamp: Date.now(),
            });
          }
        }
      } catch (err) {
        console.warn('RuralInterview profile load error:', err);
      }
    })();
  }, []);

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

    // Asynchronously persist to WatermelonDB
    persistCanonicalInputsToWatermelon({
      inputs: globalInputStore.getConfirmedValues(),
      source: provenance as ProvenanceSource,
      confirmed: true,
    }).catch((err) => console.warn('WatermelonDB persist error on confirm:', err));

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

    if (inputs.monthly_units_sold !== undefined && inputs.monthly_units_sold !== null) {
      let val = Number(inputs.monthly_units_sold);
      if (stressScenario === 'DEMAND_DROP_20') val *= 0.80;
      engineInputs.monthly_units_sold = val;
    }
    if (inputs.selling_price_per_unit !== undefined && inputs.selling_price_per_unit !== null) {
      engineInputs.selling_price_per_unit = Number(inputs.selling_price_per_unit);
    }
    if (inputs.variable_cost_per_unit !== undefined && inputs.variable_cost_per_unit !== null) {
      let val = Number(inputs.variable_cost_per_unit);
      if (stressScenario === 'RAW_MATERIAL_UP_20') val *= 1.20;
      engineInputs.variable_cost_per_unit = val;
    }

    // Fixed costs
    if (inputs.monthly_rent !== undefined && inputs.monthly_rent !== null) engineInputs.monthly_rent = Number(inputs.monthly_rent);
    if (inputs.monthly_labour_cost !== undefined && inputs.monthly_labour_cost !== null) engineInputs.monthly_labour_cost = Number(inputs.monthly_labour_cost);
    if (inputs.monthly_transport_cost !== undefined && inputs.monthly_transport_cost !== null) engineInputs.monthly_transport_cost = Number(inputs.monthly_transport_cost);
    if (inputs.monthly_other_fixed_cost !== undefined && inputs.monthly_other_fixed_cost !== null) engineInputs.monthly_other_fixed_cost = Number(inputs.monthly_other_fixed_cost);

    if (inputs.monthly_household_nonbusiness_income !== undefined && inputs.monthly_household_nonbusiness_income !== null) {
      engineInputs.monthly_household_nonbusiness_income = Number(inputs.monthly_household_nonbusiness_income);
    }
    if (inputs.monthly_household_essential_expenses !== undefined && inputs.monthly_household_essential_expenses !== null) {
      engineInputs.monthly_household_essential_expenses = Number(inputs.monthly_household_essential_expenses);
    }
    if (inputs.existing_monthly_household_debt_payments !== undefined && inputs.existing_monthly_household_debt_payments !== null) {
      engineInputs.existing_monthly_household_debt_payments = Number(inputs.existing_monthly_household_debt_payments);
    }

    const result = calculateFinancialAssessment(engineInputs, AARTHIKA_CALCULATION_POLICY);
    setAssessmentResult(result);
    if (!stressScenario) {
      setBaselineResult(result);
      setCurrentScenario(null);
    } else {
      setCurrentScenario(stressScenario);
    }

    // Persist finalized canonical inputs to WatermelonDB schema v5
    persistCanonicalInputsToWatermelon({
      inputs: globalInputStore.getConfirmedValues(),
      source: 'USER_PROVIDED',
      confirmed: true,
    }).catch((err) => console.warn('WatermelonDB persist error on calculation:', err));
  };

  const handleStressTrigger = (scenario: string | null) => {
    runCalculation(1, scenario || undefined); 
  };

  const marginAmount = Number(inputs.available_margin_capital) || 0;
  const currentScheme = getSIHSchemeTerms(marginAmount);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AARTHIKA</Text>
        </View>

        {/* Verified User Profile & Business Banner from Database */}
        {userProfile?.business && (
          <View style={styles.profileBadgeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 20 }}>🏢</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileBadgeTitle} numberOfLines={1}>
                    {userProfile.business}
                  </Text>
                  {userProfile.location && (
                    <Text style={styles.profileBadgeSub}>
                      📍 {userProfile.location} {userProfile.name ? `• 👤 ${userProfile.name}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.verifiedTag, profileSource !== 'DATABASE' && { backgroundColor: '#e1f5fe' }]}>
                <Text style={[styles.verifiedTagText, profileSource !== 'DATABASE' && { color: '#0277bd' }]}>
                  {profileSource === 'DATABASE' ? '✓ स्थानीय डेटाबेस' : '📋 स्थानीय प्रोफ़ाइल'}
                </Text>
              </View>
            </View>
          </View>
        )}

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
            
            {!schemeResult?.isOutOfScope && (
              <>
                {assessmentResult.monthly_revenue && (
                  <RealityCheckCard 
                    monthlyRevenue={assessmentResult.monthly_revenue}
                    totalExpenses={(assessmentResult.monthly_variable_cost || 0) + (assessmentResult.monthly_fixed_cost || 0)}
                    businessCash={assessmentResult.business_cash_available_for_debt_service}
                    breakEvenUnits={assessmentResult.break_even_units ?? null}
                    breakEvenStatus={assessmentResult.break_even_status}
                  />
                )}

                {assessmentResult.emi && schemeResult && (
                  <RepaymentTimeline 
                    loanAmount={assessmentResult.capitalized_principal || 0} 
                    moratoriumMonths={schemeResult.moratoriumMonths} 
                    emi={assessmentResult.emi} 
                    totalMonths={schemeResult.totalTenureMonths} 
                  />
                )}

                <SafetySplitView 
                  businessSafety={assessmentResult.business_affordability_status} 
                  familySafety={assessmentResult.household_affordability_status} 
                />
                
                <StressSimulatorGrid 
                  onStress={handleStressTrigger} 
                  baselineResult={baselineResult}
                  stressResult={currentScenario ? assessmentResult : null}
                  currentScenario={currentScenario}
                />
                
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
  doneBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  resultsContainer: { marginTop: 20 },
  profileBadgeCard: {
    backgroundColor: '#e8f5e9',
    borderColor: '#81c784',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  profileBadgeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  profileBadgeSub: {
    fontSize: 12,
    color: '#558b2f',
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: '#c8e6c9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
});
