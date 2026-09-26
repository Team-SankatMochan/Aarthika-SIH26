import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Rect, Line, Polygon, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { formatINR } from '../../engine/financeCalculator';
import {
  generateAnalyticsSnapshot,
  type BusinessPlanInputs,
  type AnalyticsSnapshot,
  type StressScenarioResult,
} from '../services/businessAnalytics';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';

/* ────────────────────────────────────────────────────────────
 *  RiskData — frontend view-model for the risk dashboard.
 *  Based on real deterministic metrics.
 * ──────────────────────────────────────────────────────────── */

export interface RiskData {
  deterministicMetrics?: {
    monthlyRevenue?: number | null;
    monthlyOperatingSurplus?: number | null;
    candidateEmi?: number | null;
    businessDscr?: number | null;
    breakEvenUnits?: number | null;
    maximumAffordableEmi?: number | null;
    affordableLoanAmount?: number | null;
    postLoanHouseholdDebtRatio?: number | null;
    businessReadiness?: string | null;
    householdReadiness?: string | null;
    overallReadiness?: string | null;
  };
  marketDataStatus?: 'NO_VERIFIED_DATA' | 'VERIFIED_DATA';
  swot: {
    strengths: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    weaknesses: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    opportunities: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    threats: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
  };
  risks: {
    risk: string;
    category: string;
    probability?: number | null;
    impact: 'Low' | 'Medium' | 'High';
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    financialExposure?: number | null;
    mitigation: string;
    source?: string;
  }[];
  financials: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    loanEMI: number;
    netCashFlow: number;
    breakEvenRevenue: number;
    safetyMargin: number;
  };
  scenarios: {
    name: string;
    label?: string;
    revenueChange: number;
    costChange: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    loanEMI: number;
    netCashFlow: number;
    businessAffordabilityStatus?: string;
    householdAffordabilityStatus?: string;
    overallReadiness?: string;
    readiness?: string;
  }[];
  recommendation: {
    decision: string;
    decisionLabel?: string;
    rationale: string;
    disclaimer?: string;
    supportingPoints: string[];
    actionItems: string[];
  };
  baseInputs?: {
    pricePerUnit: number;
    costPerUnit: number;
    salesPerMonth: number;
    monthlyFixed: number;
    personalCost?: number;
    householdEssentialExpenses?: number;
    setupCost: number;
    availableMarginCapital?: number | null;
    loanAmount?: number | null;
    interestRatePercent?: number | null;
    loanTenureMonths?: number | null;
  };
  provenance?: {
    userProvided: string[];
    calculations: string[];
    governmentRule: string;
    marketData: string;
    aiExplanationOnly: boolean;
  };
  cashFlow?: { month: string; revenue: number; expenses: number; net: number }[];
  analyticsSnapshot?: AnalyticsSnapshot;
}

interface RiskAnalysisDashboardProps {
  riskData: RiskData | null;
  loading?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ── Palette (semantic hex, readable in light & dark) ── */
const R = {
  green: '#639922',
  greenSoft: 'rgba(99,153,34,0.18)',
  amber: '#EF9F27',
  amberSoft: 'rgba(239,159,39,0.18)',
  red: '#E24B4A',
  redSoft: 'rgba(226,75,74,0.16)',
  slate: '#60646C',
};

const SEVERITY_COLOR: Record<string, string> = {
  Low: R.green,
  Medium: R.amber,
  High: R.red,
  Critical: '#C62828',
};

/* ────────────────────────────────────────────────────────────
 *  Skeleton loading state
 * ──────────────────────────────────────────────────────────── */

function SkeletonBlock({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeletonBlock, style]} />;
}

export function RiskDashboardSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <SkeletonBlock style={{ height: 120, borderRadius: 16 }} />
      <SkeletonBlock style={{ height: 90, borderRadius: 12 }} />
      <SkeletonBlock style={{ height: 90, borderRadius: 12 }} />
      <SkeletonBlock style={{ height: 220, borderRadius: 12 }} />
      <SkeletonBlock style={{ height: 160, borderRadius: 12 }} />
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Main dashboard
 * ──────────────────────────────────────────────────────────── */

export function RiskAnalysisDashboard({ riskData, loading }: RiskAnalysisDashboardProps) {
  const theme = useTheme();

  if (loading) {
    return <RiskDashboardSkeleton />;
  }

  const data = riskData;

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <ThemedView
          type="backgroundElement"
          style={[styles.emptyCard, { borderColor: theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold" themeColor="text" style={{ fontSize: 16, marginBottom: 4 }}>
            No Risk Data Available
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Run the risk test to generate your Reality Check report.
          </ThemedText>
        </ThemedView>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      style={{ flexGrow: 1 }}
    >
      <DeterministicMetricsSummary riskData={data} />
      <TopRisks riskData={data} />
      <SwotMatrix riskData={data} />
      <FinancialStressTest riskData={data} />
      <CashFlowSection riskData={data} />
      <BreakEvenSection riskData={data} />
      <RiskRegister riskData={data} />
      <WhatIfSimulator riskData={data} />
      <RecommendationCard riskData={data} />
      <Explainability riskData={data} />
    </ScrollView>
  );
}

/* ── Section wrapper ── */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" themeColor="text" style={styles.sectionHeading}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSub}>
          {subtitle}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }, style]}
    >
      {children}
    </ThemedView>
  );
}

/* ── 1. Real Deterministic Metrics Summary (Section N) ── */
function DeterministicMetricsSummary({ riskData }: { riskData: RiskData }) {
  const m = riskData.deterministicMetrics || {};
  const fmtInfo = (val: number | null | undefined, formatter: (n: number) => string, missingMsg = 'Need more information') => {
    return val !== null && val !== undefined ? formatter(val) : missingMsg;
  };

  const readinessColor = (status: string | null | undefined): ThemeColor => {
    if (status === 'READY_FOR_FINANCE_REVIEW' || status === 'PASS' || status === 'SUFFICIENT') return 'textSuccess';
    if (status === 'HIGH_RISK' || status === 'FAIL' || status === 'EXCESSIVE_DEBT') return 'textError';
    return 'textWarning';
  };

  return (
    <Section title="Deterministic Financial Readiness" subtitle="Calculated from confirmed plan inputs against policy benchmarks">
      <Card style={{ padding: Spacing.two }}>
        {/* Core Business Metrics */}
        <ThemedText type="smallBold" themeColor="text" style={{ marginBottom: 8, fontSize: 13, textTransform: 'uppercase' }}>
          Business Economics
        </ThemedText>
        <View style={styles.metricsGrid}>
          <MetricCell
            label="Monthly Revenue"
            value={fmtInfo(m.monthlyRevenue, formatINR)}
          />
          <MetricCell
            label="Operating Surplus (before EMI)"
            value={fmtInfo(m.monthlyOperatingSurplus, formatINR)}
            tone={m.monthlyOperatingSurplus != null && m.monthlyOperatingSurplus > 0 ? 'textSuccess' : 'textError'}
          />
          <MetricCell
            label="Break-even Units"
            value={fmtInfo(m.breakEvenUnits, n => `${n} units`)}
          />
          <MetricCell
            label="Business Readiness"
            value={m.businessReadiness || 'Need more information'}
            tone={readinessColor(m.businessReadiness)}
          />
        </View>

        {/* Financing Metrics */}
        <View style={styles.sectionDivider} />
        <ThemedText type="smallBold" themeColor="text" style={{ marginBottom: 8, fontSize: 13, textTransform: 'uppercase' }}>
          Financing & Debt Service
        </ThemedText>
        <View style={styles.metricsGrid}>
          <MetricCell
            label="Candidate EMI"
            value={fmtInfo(m.candidateEmi, formatINR, 'Need financing terms')}
          />
          <MetricCell
            label="Business DSCR"
            value={fmtInfo(m.businessDscr, n => n.toFixed(2), 'Need financing terms')}
            tone={m.businessDscr != null && m.businessDscr >= 1.25 ? 'textSuccess' : 'textError'}
          />
          <MetricCell
            label="Max Affordable EMI"
            value={fmtInfo(m.maximumAffordableEmi, formatINR)}
          />
          <MetricCell
            label="Affordable Loan Amount"
            value={fmtInfo(m.affordableLoanAmount, formatINR)}
          />
        </View>

        {/* Household & Overall */}
        <View style={styles.sectionDivider} />
        <ThemedText type="smallBold" themeColor="text" style={{ marginBottom: 8, fontSize: 13, textTransform: 'uppercase' }}>
          Household & Overall Readiness
        </ThemedText>
        <View style={styles.metricsGrid}>
          <MetricCell
            label="Household Debt Ratio"
            value={fmtInfo(m.postLoanHouseholdDebtRatio, n => `${(n * 100).toFixed(0)}%`, 'Need household data')}
            tone={m.postLoanHouseholdDebtRatio != null && m.postLoanHouseholdDebtRatio <= 0.50 ? 'textSuccess' : 'textError'}
          />
          <MetricCell
            label="Household Readiness"
            value={m.householdReadiness || 'Need more information'}
            tone={readinessColor(m.householdReadiness)}
          />
          <MetricCell
            label="Overall Readiness"
            value={m.overallReadiness || 'Need more information'}
            tone={readinessColor(m.overallReadiness)}
          />
        </View>
      </Card>
    </Section>
  );
}

function MetricCell({ label, value, tone = 'text' }: { label: string; value: string; tone?: ThemeColor }) {
  const theme = useTheme();
  return (
    <View style={[styles.metricCell, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 11 }}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={tone} style={{ fontSize: 14, marginTop: 4 }}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ── 2. Top Critical Risks (Evidence-backed only, Section O) ── */
function TopRisks({ riskData }: { riskData: RiskData }) {
  const sorted = [...riskData.risks].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );
  const top = sorted.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <Section title="Critical Risk Findings" subtitle="Address these before finalizing business operations">
      {top.map((risk, i) => (
        <Card key={i} style={styles.criticalRiskCard}>
          <View style={styles.criticalHeader}>
            <View style={[styles.rankBadge, { backgroundColor: SEVERITY_COLOR[risk.severity] || R.amber }]}>
              <Text style={styles.rankBadgeText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" themeColor="text">
                {risk.risk}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {risk.category}
                {risk.probability != null ? ` · Probability ${Math.round(risk.probability * 100)}%` : ''}
              </ThemedText>
            </View>
            <ThemedText
              type="smallBold"
              themeColor={severityThemeColor(risk.severity)}
              style={{ textTransform: 'uppercase' }}
            >
              {risk.severity}
            </ThemedText>
          </View>
          <View style={styles.criticalBody}>
            {risk.financialExposure != null && risk.financialExposure > 0 ? (
              <View style={styles.criticalStat}>
                <ThemedText type="small" themeColor="textSecondary">
                  Financial exposure
                </ThemedText>
                <ThemedText type="smallBold" themeColor="text">
                  {formatINR(risk.financialExposure)}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.criticalStat}>
              <ThemedText type="small" themeColor="textSecondary">
                Detail
              </ThemedText>
              <ThemedText type="small" themeColor="text" style={{ flexShrink: 1 }}>
                {risk.mitigation}
              </ThemedText>
            </View>
          </View>
        </Card>
      ))}
    </Section>
  );
}

/* ── 3. Risk Register (Evidence-backed only, Section O) ── */
function RiskRegister({ riskData }: { riskData: RiskData }) {
  if (riskData.risks.length === 0) return null;

  return (
    <Section title="Risk Register" subtitle="Documented risk findings and mitigations">
      <View style={styles.riskCardList}>
        {riskData.risks.map((risk, i) => {
          const sevColor = SEVERITY_COLOR[risk.severity] || R.amber;
          const hasExposure = risk.financialExposure != null && risk.financialExposure > 0;
          const hasProbability = risk.probability != null;

          return (
            <Card key={i} style={[styles.mobileRiskCard, { borderLeftColor: sevColor, borderLeftWidth: 4 }]}>
              <View style={styles.mobileRiskHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <ThemedText type="smallBold" themeColor="text" style={{ fontSize: 15, lineHeight: 20 }}>
                    {risk.risk}
                  </ThemedText>
                  <View style={styles.mobileCategoryBadge}>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, fontWeight: '600' }}>
                      {risk.category}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.severityPill, { backgroundColor: sevColor + '20', borderColor: sevColor }]}>
                  <Text style={[styles.severityPillText, { color: sevColor }]}>
                    {risk.severity}
                  </Text>
                </View>
              </View>

              {(hasProbability || hasExposure) && (
                <View style={styles.mobileRiskStatsRow}>
                  {hasProbability && (
                    <View style={styles.mobileRiskStatItem}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                        Probability
                      </ThemedText>
                      <ThemedText type="smallBold" themeColor="text" style={styles.statMiniValue}>
                        {Math.round(risk.probability! * 100)}%
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.mobileRiskStatItem}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                      Impact
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="text" style={styles.statMiniValue}>
                      {risk.impact}
                    </ThemedText>
                  </View>

                  {hasExposure && (
                    <View style={styles.mobileRiskStatItem}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                        Exposure
                      </ThemedText>
                      <ThemedText type="smallBold" themeColor="textError" style={styles.statMiniValue}>
                        {formatINR(risk.financialExposure!)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {risk.mitigation ? (
                <View style={styles.mobileMitigationBox}>
                  <Text style={styles.mitigationShieldIcon}>🛡️</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 11, marginBottom: 2 }}>
                      Detail / Mitigation
                    </ThemedText>
                    <ThemedText type="small" themeColor="text" style={{ fontSize: 12, lineHeight: 17 }}>
                      {risk.mitigation}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Section>
  );
}

/* ── 4. SWOT Matrix ── */
function SwotMatrix({ riskData }: { riskData: RiskData }) {
  const { swot } = riskData;
  const quadrants = [
    { title: 'Strengths', items: swot.strengths, color: R.green },
    { title: 'Weaknesses', items: swot.weaknesses, color: R.red },
    { title: 'Opportunities', items: swot.opportunities, color: '#1E88E5' },
    { title: 'Threats', items: swot.threats, color: R.amber },
  ];

  return (
    <Section title="SWOT Analysis" subtitle="Dynamic strategic analysis from your numbers">
      <View style={styles.swotGrid}>
        {quadrants.map((q, idx) => (
          <View key={idx} style={[styles.swotQuadrant, { borderTopColor: q.color }]}>
            <View style={styles.swotHeader}>
              <ThemedText type="smallBold" themeColor="text">
                {q.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ({q.items.length})
              </ThemedText>
            </View>
            {q.items.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ fontStyle: 'italic', marginTop: 4 }}>
                None noted
              </ThemedText>
            ) : (
              q.items.map((it, i) => (
                <View key={i} style={styles.swotItem}>
                  <ThemedText type="small" themeColor="text" style={{ fontWeight: '600' }}>
                    • {it.finding}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.swotMeta}>
                    {it.whyItMatters}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        ))}
      </View>
    </Section>
  );
}

/* ── 5. Financial Stress Test ── */
function FinancialStressTest({ riskData }: { riskData: RiskData }) {
  if (riskData.scenarios.length === 0) return null;

  return (
    <Section title="Financial Stress Test" subtitle="Deterministic sensitivity under demand shock and cost increase">
      <View style={styles.stressGrid}>
        {riskData.scenarios.map((s, i) => {
          const healthy = s.netCashFlow >= 0;
          return (
            <Card key={i} style={[styles.scenarioCard, { borderLeftColor: healthy ? R.green : R.red, borderLeftWidth: 3 }]}>
              <View style={styles.scenarioHeader}>
                <ThemedText type="smallBold" themeColor="text">
                  {s.label || s.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Rev {s.revenueChange > 0 ? '+' : ''}{s.revenueChange}% · Cost {s.costChange > 0 ? '+' : ''}{s.costChange}%
                </ThemedText>
              </View>
              <View style={styles.scenarioMetrics}>
                <MetricPair label="Revenue" value={formatINR(s.monthlyRevenue)} />
                <MetricPair label="Expenses" value={formatINR(s.monthlyExpenses)} />
                <MetricPair label="EMI" value={formatINR(s.loanEMI)} />
                <MetricPair
                  label="Net Cash Flow"
                  value={formatINR(s.netCashFlow)}
                  valueTone={healthy ? 'textSuccess' : 'textError'}
                />
              </View>
              <View style={styles.scenarioBar}>
                <View
                  style={[
                    styles.scenarioBarFill,
                    {
                      width: `${Math.min(Math.abs(s.netCashFlow) / Math.max(Math.abs(riskData.financials.monthlyRevenue), 1) * 100, 100)}%`,
                      backgroundColor: healthy ? R.green : R.red,
                    },
                  ]}
                />
              </View>
            </Card>
          );
        })}
      </View>
    </Section>
  );
}

function MetricPair({
  label,
  value,
  valueTone = 'text',
}: {
  label: string;
  value: string;
  valueTone?: ThemeColor;
}) {
  return (
    <View style={styles.metricPair}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={valueTone}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ── 6. Cash Flow Projection ── */
function CashFlowSection({ riskData }: { riskData: RiskData }) {
  const series = riskData.cashFlow ?? buildCashFlowSeries(riskData);

  const W = Math.min(SCREEN_WIDTH - 64, 380);
  const H = 140;
  const pad = 24;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const maxVal = Math.max(...series.map((d) => Math.max(d.revenue, d.expenses)), 1000);
  const minNet = Math.min(...series.map((d) => d.net), 0);
  const maxNet = Math.max(...series.map((d) => d.net), 1000);
  const netRange = maxNet - minNet || 1;

  const xStep = innerW / (series.length - 1);
  const revPoints = series
    .map((d, i) => `${pad + i * xStep},${pad + innerH - (d.revenue / maxVal) * innerH}`)
    .join(' ');
  const expPoints = series
    .map((d, i) => `${pad + i * xStep},${pad + innerH - (d.expenses / maxVal) * innerH}`)
    .join(' ');
  const netPoints = series
    .map((d, i) => `${pad + i * xStep},${pad + innerH - ((d.net - minNet) / netRange) * innerH}`)
    .join(' ');

  return (
    <Section title="Cash Flow Projection" subtitle="12-month projection based on confirmed unit economics">
      <Card>
        <Svg width={W} height={H}>
          <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(150,150,150,0.3)" strokeWidth={1} />
          <Polyline points={revPoints} fill="none" stroke={R.green} strokeWidth={2} />
          <Polyline points={expPoints} fill="none" stroke={R.red} strokeWidth={2} strokeDasharray="4,4" />
          <Polyline points={netPoints} fill="none" stroke={R.amber} strokeWidth={2} />

          {series.map((d, i) => (
            <Circle
              key={i}
              cx={pad + i * xStep}
              cy={pad + innerH - ((d.net - minNet) / netRange) * innerH}
              r={2.5}
              fill={R.amber}
            />
          ))}
        </Svg>

        <View style={styles.chartLegend}>
          <LegendDot color={R.green} label="Revenue" />
          <LegendDot color={R.red} label="Expenses" dashed />
          <LegendDot color={R.amber} label="Net" />
        </View>
      </Card>
    </Section>
  );
}

/* ── 7. Break-Even Analysis ── */
function BreakEvenSection({ riskData }: { riskData: RiskData }) {
  const f = riskData.financials;
  const breakEven = f.breakEvenRevenue;
  const actual = f.monthlyRevenue;
  const safe = actual >= breakEven;
  const ratio = breakEven > 0 ? actual / breakEven : 0;
  const max = Math.max(breakEven, actual) * 1.25 || 1;

  const actualPct = Math.min((actual / max) * 100, 100);
  const bePct = Math.min((breakEven / max) * 100, 100);

  return (
    <Section title="Break-Even Analysis" subtitle="Minimum monthly sales to cover all business costs">
      <Card>
        <View style={styles.beRow}>
          <MetricPair label="Actual revenue" value={formatINR(actual)} />
          <MetricPair label="Break-even revenue" value={formatINR(breakEven)} />
          <MetricPair
            label="Safety margin"
            value={formatINR(f.safetyMargin)}
            valueTone={safe ? 'textSuccess' : 'textError'}
          />
        </View>

        <View style={styles.beMeter}>
          <View
            style={[
              styles.beMeterFill,
              { width: `${actualPct}%`, backgroundColor: safe ? R.greenSoft : R.redSoft },
            ]}
          />
          <View style={[styles.beMeterMark, { left: `${bePct}%` }]} />
        </View>
        <View style={styles.beLabels}>
          <ThemedText type="small" themeColor="textSecondary">
            0
          </ThemedText>
          <ThemedText type="smallBold" themeColor="text">
            Break-even: {formatINR(breakEven)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatINR(max)}
          </ThemedText>
        </View>
      </Card>
    </Section>
  );
}

function StatPill({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <View style={styles.statPill}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={positive ? 'textSuccess' : 'textError'}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ── 8. What-If Simulator (Sections Q & R: strictly uses FinanceEngine) ── */
function WhatIfSimulator({ riskData }: { riskData: RiskData }) {
  const base = riskData.baseInputs;
  const initialPrice = base?.pricePerUnit ?? 40;
  const initialCost = base?.costPerUnit ?? 18;
  const initialSales = base?.salesPerMonth ?? 500;
  const initialFixed = base?.monthlyFixed ?? 4000;
  const initialMargin = base?.availableMarginCapital ?? 10000;

  const [price, setPrice] = useState(initialPrice);
  const [cost, setCost] = useState(initialCost);
  const [sales, setSales] = useState(initialSales);
  const [fixed, setFixed] = useState(initialFixed);
  const [margin, setMargin] = useState(initialMargin);

  const simSnapshot = useMemo(() => {
    const modifiedPlan: BusinessPlanInputs = {
      ...(riskData.analyticsSnapshot?.inputs || {}),
      sellingPricePerUnit: price,
      variableCostPerUnit: cost,
      monthlyUnitsSold: sales,
      monthlyBusinessFixedCost: fixed,
      availableMarginCapital: margin > 0 ? margin : null,
    };
    return generateAnalyticsSnapshot(modifiedPlan);
  }, [price, cost, sales, fixed, margin, riskData.analyticsSnapshot?.inputs]);

  const rev = simSnapshot.monthlyRevenue ?? (sales * price);
  const surplus = simSnapshot.operatingSurplus ?? (rev - (sales * cost) - fixed);
  const emi = simSnapshot.candidateEmi;
  const dscr = simSnapshot.businessDscr;
  const breakEvenUnits = simSnapshot.breakEvenUnits;
  const breakEvenStatus = simSnapshot.breakEvenStatus;
  const breakEvenRev = (breakEvenStatus === 'VIABLE' && breakEvenUnits != null) ? breakEvenUnits * price : null;
  const isSurplusPositive = surplus > 0;
  const meetsDscr = dscr != null && dscr >= 1.25;

  return (
    <Section title="What-If Simulator" subtitle="Stress-test using the canonical Finance Engine">
      <Card>
        <View style={styles.simSummary}>
          <StatPill label="Projected revenue" value={formatINR(rev)} positive={rev > 0} />
          <StatPill label="Operating surplus" value={formatINR(surplus)} positive={isSurplusPositive} />
          <StatPill
            label="Break-even"
            value={breakEvenStatus === 'VIABLE' && breakEvenUnits != null ? `${breakEvenUnits} units` : (breakEvenStatus || 'Unviable')}
            positive={breakEvenStatus === 'VIABLE' && sales >= (breakEvenUnits || 0)}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8 }}>
          <View style={[styles.statPill, { flex: 1 }]}>
            <ThemedText type="small" themeColor="textSecondary">Candidate EMI</ThemedText>
            <ThemedText type="smallBold" themeColor="text">
              {emi != null ? formatINR(emi) : 'Need financing terms'}
            </ThemedText>
          </View>
          <View style={[styles.statPill, { flex: 1 }]}>
            <ThemedText type="small" themeColor="textSecondary">Business DSCR</ThemedText>
            <ThemedText type="smallBold" themeColor={meetsDscr ? 'textSuccess' : 'textError'}>
              {dscr != null ? dscr.toFixed(2) : 'N/A'}
            </ThemedText>
          </View>
        </View>

        <SimSlider label="Selling price / unit" value={price} min={5} max={500} step={5} onChange={setPrice} prefix="₹" />
        <SimSlider label="Cost / unit" value={cost} min={1} max={300} step={5} onChange={setCost} prefix="₹" />
        <SimSlider label="Units sold / month" value={sales} min={10} max={5000} step={25} onChange={setSales} />
        <SimSlider label="Monthly fixed costs" value={fixed} min={0} max={50000} step={500} onChange={setFixed} prefix="₹" />
        <SimSlider label="Own margin capital" value={margin} min={0} max={500000} step={5000} onChange={setMargin} prefix="₹" />

        <View style={[styles.simVerdict, { backgroundColor: isSurplusPositive ? R.greenSoft : R.redSoft }]}>
          <ThemedText type="smallBold" themeColor={isSurplusPositive ? 'textSuccess' : 'textError'}>
            {isSurplusPositive
              ? (dscr != null && dscr >= 1.25 ? '✓ Structurally viable & meets DSCR threshold' : '✓ Positive operating surplus')
              : '✗ Operating loss at these settings'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Readiness: {simSnapshot.overallReadiness} · Break-even revenue {breakEvenRev ? formatINR(breakEvenRev) : 'N/A'}
          </ThemedText>
        </View>
      </Card>
    </Section>
  );
}

function SimSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  return (
    <View style={styles.simRow}>
      <View style={styles.simLabelRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="text">
          {prefix}
          {value.toLocaleString('en-IN')}
        </ThemedText>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={R.amber}
        maximumTrackTintColor="rgba(150,150,150,0.3)"
        thumbTintColor={R.amber}
        style={{ height: 28 }}
      />
    </View>
  );
}

/* ── 9. Recommendation Card (Section M: Canonical states & disclaimer) ── */
function RecommendationCard({ riskData }: { riskData: RiskData }) {
  const { decision, decisionLabel, rationale, disclaimer, supportingPoints, actionItems } = riskData.recommendation;
  
  const isReady = decision === 'READY_FOR_FINANCE_REVIEW';
  const isHighRisk = decision === 'HIGH_RISK';
  const isOutOfScope = decision === 'OUT_OF_SCOPE';
  const palette = isReady ? { bg: R.greenSoft, border: R.green, text: R.green }
    : isHighRisk ? { bg: R.redSoft, border: R.red, text: R.red }
    : { bg: R.amberSoft, border: R.amber, text: R.amber };

  const displayTitle = decisionLabel || (
    isReady ? 'Ready for finance review'
    : isHighRisk ? 'Financial pressure detected'
    : isOutOfScope ? 'Outside this scheme route'
    : 'More information needed'
  );

  return (
    <Section title="Business Plan Readiness" subtitle="Deterministic policy evaluation">
      <View style={[styles.recommendationCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.recommendationBadge, { color: palette.text, borderColor: palette.border }]}>
          {displayTitle}
        </Text>
        <ThemedText type="small" style={{ textAlign: 'center', marginTop: Spacing.two, color: '#3E2723' }}>
          {rationale}
        </ThemedText>
        <ThemedText type="small" style={{ textAlign: 'center', marginTop: 4, color: '#8D6E63', fontStyle: 'italic', fontSize: 11 }}>
          {disclaimer || 'This is a business-plan readiness assessment, not loan approval.'}
        </ThemedText>

        {supportingPoints.length > 0 && (
          <View style={styles.recoColumn}>
            <ThemedText type="smallBold" style={{ color: '#3E2723' }}>
              Findings
            </ThemedText>
            {supportingPoints.map((p, i) => (
              <ThemedText key={i} type="small" style={[styles.recoBullet, { color: '#5D4037' }]}>
                • {p}
              </ThemedText>
            ))}
          </View>
        )}

        {actionItems.length > 0 && (
          <View style={styles.recoColumn}>
            <ThemedText type="smallBold" style={{ color: '#3E2723' }}>
              Suggested Next Steps
            </ThemedText>
            {actionItems.map((a, i) => (
              <ThemedText key={i} type="small" style={[styles.recoBullet, { color: '#5D4037' }]}>
                → {a}
              </ThemedText>
            ))}
          </View>
        )}
      </View>
    </Section>
  );
}

/* ── 10. Explainability & Provenance (Section S) ── */
function Explainability({ riskData }: { riskData: RiskData }) {
  const prov = riskData.provenance;
  return (
    <Section title="Analysis Sources & Traceability" subtitle="Where this assessment comes from">
      <Card>
        <ThemedText type="smallBold" themeColor="text" style={{ marginBottom: 8 }}>
          ANALYSIS SOURCES
        </ThemedText>

        <View style={{ gap: 6, marginBottom: 12 }}>
          <ThemedText type="small" themeColor="text">
            ✓ User provided: {prov?.userProvided?.length ? prov.userProvided.join(', ') : 'Unit pricing, sales volume, fixed costs'}
          </ThemedText>
          <ThemedText type="small" themeColor="text">
            ✓ AARTHIKA calculation: Revenue, Operating Surplus, Break-even, Candidate EMI, DSCR, Stress Scenarios
          </ThemedText>
          <ThemedText type="small" themeColor="text">
            ✓ Government rule: {prov?.governmentRule || 'SIH Scheme Guidelines (Rate, Cap, Tenure)'}
          </ThemedText>
          <ThemedText type="small" style={{ color: '#D97706', fontWeight: '600' }}>
            ⚠ Market data: No verified local market data available (requires on-ground validation)
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ✓ AI explanation: Explanation only — no financial calculations
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
          All financial values are strictly computed by deterministic policy formulas. AI is used solely to explain results.
        </ThemedText>
      </Card>
    </Section>
  );
}

function severityRank(s: string): number {
  switch (s) {
    case 'Critical': return 4;
    case 'High': return 3;
    case 'Medium': return 2;
    default: return 1;
  }
}

function severityThemeColor(s: string): ThemeColor {
  switch (s) {
    case 'Critical':
    case 'High': return 'textError';
    case 'Medium': return 'textWarning';
    default: return 'textSuccess';
  }
}

function buildCashFlowSeries(riskData: RiskData): { month: string; revenue: number; expenses: number; net: number }[] {
  const f = riskData.financials;
  const months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];
  return months.map((month) => ({
    month,
    revenue: f.monthlyRevenue,
    expenses: f.monthlyExpenses + f.loanEMI,
    net: f.monthlyRevenue - (f.monthlyExpenses + f.loanEMI),
  }));
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          { backgroundColor: dashed ? 'transparent' : color, borderColor: color, borderWidth: dashed ? 1 : 0 },
        ]}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Styles
 * ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    padding: Spacing.two,
    paddingBottom: Spacing.four * 2,
    gap: Spacing.three,
  },
  skeletonWrap: {
    padding: Spacing.two,
    gap: Spacing.two,
  },
  skeletonBlock: {
    backgroundColor: 'rgba(150,150,150,0.18)',
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  section: {
    gap: Spacing.one,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: {
    marginBottom: Spacing.one,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.two,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginVertical: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCell: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 10,
    padding: Spacing.two,
  },
  criticalRiskCard: {
    marginBottom: Spacing.two,
    borderLeftWidth: 3,
  },
  criticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  criticalBody: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  criticalStat: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  riskCardList: {
    gap: Spacing.two,
  },
  mobileRiskCard: {
    borderRadius: 12,
    padding: 12,
  },
  mobileRiskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  mobileCategoryBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mobileRiskStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(150,150,150,0.06)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  mobileRiskStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  statMiniLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statMiniValue: {
    fontSize: 12,
  },
  mobileMitigationBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(150,150,150,0.08)',
    borderRadius: 8,
    padding: 8,
  },
  mitigationShieldIcon: {
    fontSize: 16,
  },
  swotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  swotQuadrant: {
    width: '48%',
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 12,
    padding: Spacing.two,
    borderTopWidth: 3,
    backgroundColor: 'rgba(150,150,150,0.08)',
  },
  swotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  swotItem: {
    marginBottom: Spacing.two,
  },
  swotMeta: {
    marginTop: 2,
  },
  stressGrid: {
    gap: Spacing.two,
  },
  scenarioCard: {
    marginBottom: 0,
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  scenarioMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  metricPair: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: Spacing.half,
  },
  scenarioBar: {
    marginTop: Spacing.two,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.15)',
    overflow: 'hidden',
  },
  scenarioBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  beRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  beMeter: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(150,150,150,0.2)',
    overflow: 'hidden',
  },
  beMeterFill: {
    height: '100%',
    borderRadius: 7,
  },
  beMeterMark: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: R.slate,
  },
  beLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.half,
  },
  simSummary: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  statPill: {
    flex: 1,
    borderRadius: 10,
    padding: Spacing.one,
    backgroundColor: 'rgba(150,150,150,0.08)',
    alignItems: 'center',
  },
  simRow: {
    marginVertical: Spacing.half,
  },
  simLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.half,
  },
  simVerdict: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: 10,
    gap: 4,
  },
  recommendationCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
  },
  recommendationBadge: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recoColumn: {
    width: '100%',
    marginTop: Spacing.two,
    gap: Spacing.half,
  },
  recoBullet: {
    fontSize: 13,
    lineHeight: 18,
  },
});
