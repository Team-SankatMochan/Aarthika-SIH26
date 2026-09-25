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
import { GoNoGoGauge } from '../../components/GoNoGoGauge';
import { formatINR } from '../../engine/financeCalculator';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';

/* ────────────────────────────────────────────────────────────
 *  RiskData — frontend view-model for the risk dashboard.
 *  Every section of the dashboard reads from this one shape.
 * ──────────────────────────────────────────────────────────── */

export interface RiskData {
  overallRiskScore: number; // 0-1 (higher = riskier)
  businessViabilityScore: number; // 0-1 (higher = healthier)
  financialResilience: number; // 0-1
  marketRisk: number; // 0-1
  operationalRisk: number; // 0-1
  swot: {
    strengths: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    weaknesses: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    opportunities: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
    threats: { finding: string; whyItMatters: string; impact: 'Low' | 'Medium' | 'High'; evidence?: string }[];
  };
  risks: {
    risk: string;
    category: string;
    probability: number; // 0-1
    impact: 'Low' | 'Medium' | 'High';
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    financialExposure: number;
    mitigation: string;
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
    revenueChange: number;
    costChange: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    loanEMI: number;
    netCashFlow: number;
  }[];
  recommendation: {
    decision: 'GO' | 'CAUTION' | 'NO-GO';
    rationale: string;
    supportingPoints: string[];
    actionItems: string[];
  };
  /** Base business inputs — drives the What-If simulator (optional; falls back to financials). */
  baseInputs?: {
    pricePerUnit: number;
    costPerUnit: number;
    salesPerMonth: number;
    monthlyFixed: number;
    personalCost: number;
    setupCost: number;
    loanAmount: number;
    interestRatePercent: number;
    loanTenureMonths: number;
  };
  /** Pre-computed 12-month cash flow series (optional; synthesized from financials if absent). */
  cashFlow?: { month: string; revenue: number; expenses: number; net: number }[];
}

interface RiskAnalysisDashboardProps {
  riskData: RiskData | null;
  loading?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ── Risk palette (semantic hex, readable in light & dark) ── */
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

/* Map a 0-1 score to a ThemeColor key so ThemedText accepts it. */
function scoreThemeColor(score: number): ThemeColor {
  if (score >= 0.7) return 'textError';
  if (score >= 0.4) return 'textWarning';
  return 'textSuccess';
}

/* Map a 0-1 *viability* score (higher = better) to a ThemeColor key. */
function viabilityThemeColor(score: number): ThemeColor {
  if (score >= 0.7) return 'textSuccess';
  if (score >= 0.4) return 'textWarning';
  return 'textError';
}

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

  const data = useMemo<RiskData | null>(() => {
    if (!riskData) return null;
    // Normalize scores into 0-1 so downstream math is safe.
    const clamp = (n: number) => Math.min(Math.max(n || 0, 0), 1);
    return {
      ...riskData,
      overallRiskScore: clamp(riskData.overallRiskScore),
      businessViabilityScore: clamp(riskData.businessViabilityScore),
      financialResilience: clamp(riskData.financialResilience),
      marketRisk: clamp(riskData.marketRisk),
      operationalRisk: clamp(riskData.operationalRisk),
    };
  }, [riskData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <RiskDashboardSkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <Text style={{ fontSize: 40 }}>📊</Text>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
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
      <ExecutiveSummary riskData={data} />
      <TopRisks riskData={data} />
      <SwotMatrix riskData={data} />
      <RiskHeatmap riskData={data} />
      <FinancialStressTest riskData={data} />
      <CashFlowSection riskData={data} />
      <BreakEvenSection riskData={data} />
      <RiskRegister riskData={data} />
      <RiskContribution riskData={data} />
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

/* ── 1. Executive Risk Summary ── */
function ExecutiveSummary({ riskData }: { riskData: RiskData }) {
  const { overallRiskScore, businessViabilityScore, financialResilience, marketRisk, operationalRisk } = riskData;

  return (
    <Section title="Executive Risk Summary" subtitle="Overall viability & risk posture">
      <View style={styles.summaryRow}>
        <View style={styles.summaryGaugeCard}>
          <ThemedText type="smallBold" style={{ color: '#1F1F1F', marginBottom: 10 }}>
            Overall Risk
          </ThemedText>
          <GoNoGoGauge riskRatio={overallRiskScore} size={190} />
        </View>

        <View style={styles.summaryMetrics}>
          <MetricChip
            label="Business Viability"
            value={`${Math.round(businessViabilityScore * 100)}%`}
            tone={viabilityThemeColor(businessViabilityScore)}
          />
          <MetricChip
            label="Financial Resilience"
            value={`${Math.round(financialResilience * 100)}%`}
            tone={viabilityThemeColor(financialResilience)}
          />
          <MetricChip
            label="Market Risk"
            value={`${Math.round(marketRisk * 100)}%`}
            tone={scoreThemeColor(marketRisk)}
          />
          <MetricChip
            label="Operational Risk"
            value={`${Math.round(operationalRisk * 100)}%`}
            tone={scoreThemeColor(operationalRisk)}
          />
        </View>
      </View>
    </Section>
  );
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: ThemeColor }) {
  const theme = useTheme();
  return (
    <View style={[styles.metricChip, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, marginRight: 8 }}>
        {label}
      </ThemedText>
      <ThemedText type="default" themeColor={tone} style={{ fontWeight: '700' }}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ── 2. Top 3 Critical Risks ── */
function TopRisks({ riskData }: { riskData: RiskData }) {
  const sorted = [...riskData.risks].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.probability - a.probability
  );
  const top = sorted.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <Section title="Top 3 Critical Risks" subtitle="Address these before taking the loan">
      {top.map((risk, i) => (
        <Card key={i} style={styles.criticalRiskCard}>
          <View style={styles.criticalHeader}>
            <View style={[styles.rankBadge, { backgroundColor: SEVERITY_COLOR[risk.severity] }]}>
              <Text style={styles.rankBadgeText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" themeColor="text">
                {risk.risk}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {risk.category} · Probability {Math.round(risk.probability * 100)}%
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
            <View style={styles.criticalStat}>
              <ThemedText type="small" themeColor="textSecondary">
                Financial exposure
              </ThemedText>
              <ThemedText type="smallBold" themeColor="text">
                {formatINR(risk.financialExposure)}
              </ThemedText>
            </View>
            <View style={styles.criticalStat}>
              <ThemedText type="small" themeColor="textSecondary">
                Mitigation
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

/* ── 3. Risk Register (Mobile-first Stacked Cards) ── */
function RiskRegister({ riskData }: { riskData: RiskData }) {
  if (riskData.risks.length === 0) return null;

  return (
    <Section title="Risk Register" subtitle="Quantified risks with exposure and mitigation">
      <View style={styles.riskCardList}>
        {riskData.risks.map((risk, i) => {
          const sevColor = SEVERITY_COLOR[risk.severity] || R.amber;
          return (
            <Card key={i} style={[styles.mobileRiskCard, { borderLeftColor: sevColor, borderLeftWidth: 4 }]}>
              {/* Header: Risk title, category & severity pill */}
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

              {/* Stats row: Probability, Impact, Financial Exposure */}
              <View style={styles.mobileRiskStatsRow}>
                <View style={styles.mobileRiskStatItem}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                    Probability
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="text" style={styles.statMiniValue}>
                    {Math.round(risk.probability * 100)}%
                  </ThemedText>
                </View>

                <View style={styles.mobileRiskStatItem}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                    Impact
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="text" style={styles.statMiniValue}>
                    {risk.impact}
                  </ThemedText>
                </View>

                <View style={styles.mobileRiskStatItem}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.statMiniLabel}>
                    Exposure
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="textError" style={styles.statMiniValue}>
                    {formatINR(risk.financialExposure)}
                  </ThemedText>
                </View>
              </View>

              {/* Mitigation Box */}
              {risk.mitigation ? (
                <View style={styles.mobileMitigationBox}>
                  <Text style={styles.mitigationShieldIcon}>🛡️</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 11, marginBottom: 2 }}>
                      Mitigation Strategy
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

/* ── 4. SWOT 2×2 Matrix ── */
function SwotMatrix({ riskData }: { riskData: RiskData }) {
  const quadrants = [
    { key: 'strengths', title: 'Strengths', sign: 'Internal +', color: R.green },
    { key: 'weaknesses', title: 'Weaknesses', sign: 'Internal −', color: R.red },
    { key: 'opportunities', title: 'Opportunities', sign: 'External +', color: R.green },
    { key: 'threats', title: 'Threats', sign: 'External −', color: R.red },
  ] as const;

  return (
    <Section title="SWOT Analysis" subtitle="Internal & external factors at a glance">
      <View style={styles.swotGrid}>
        {quadrants.map((q) => {
          const items = riskData.swot[q.key];
          return (
            <View key={q.key} style={[styles.swotQuadrant, { borderTopColor: q.color }]}>
              <View style={styles.swotHeader}>
                <ThemedText type="smallBold" style={{ color: '#1F1F1F' }}>
                  {q.title.toUpperCase()}
                </ThemedText>
                <ThemedText type="small" style={{ color: '#60646C' }}>
                  {q.sign}
                </ThemedText>
              </View>
              {items.length === 0 ? (
                <ThemedText type="small" style={{ color: '#60646C' }}>
                  No items identified
                </ThemedText>
              ) : (
                items.map((item, i) => (
                  <View key={i} style={styles.swotItem}>
                    <ThemedText type="small" style={{ fontWeight: '600', color: '#1F1F1F' }}>
                      • {item.finding}
                    </ThemedText>
                    {item.whyItMatters ? (
                      <ThemedText type="small" style={{ color: '#60646C' }}>
                        {item.whyItMatters}
                      </ThemedText>
                    ) : null}
                    <View style={styles.swotMeta}>
                      <View style={[styles.impactPill, { backgroundColor: impactSoft(item.impact) }]}>
                        <Text style={[styles.impactPillText, { color: impactHex(item.impact) }]}>
                          {item.impact} impact
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

/* ── 4. Risk Heatmap (Probability × Impact) ── */
function RiskHeatmap({ riskData }: { riskData: RiskData }) {
  const theme = useTheme();
  const isDark = theme.background === '#000000';
  const axisLabel = isDark ? '#B0B4BA' : '#60646C';
  const cellEmpty = isDark ? '#212225' : '#F0F0F3';
  const risks = riskData.risks;
  if (risks.length === 0) return null;

  const IMPACT_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Critical'];
  const PROB_LABELS = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
  const CELL = 42;
  const W = 5 * CELL;
  const H = 5 * CELL;
  const LEFT = 46;
  const TOP = 18;
  const BOTTOM = 30;

  // Impact index per risk (VeryLow=0 … Critical=4)
  const impactIndex = (impact: string) => {
    if (impact === 'Low') return 1;
    if (impact === 'Medium') return 2;
    if (impact === 'High') return 3;
    return 4;
  };

  // Probability bucket row (row 0 = top / 80-100%)
  const probRow = (p: number) => {
    const b = Math.min(Math.floor(p * 5), 4); // 0..4
    return 4 - b;
  };

  return (
    <Section title="Risk Heatmap" subtitle="Probability × Impact — darker = higher severity">
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <Svg width={LEFT + W + 4} height={TOP + H + BOTTOM}>
              {/* Column headers (Impact) */}
              {IMPACT_LEVELS.map((label, i) => (
                <SvgText
                  key={`hx-${i}`}
                  x={LEFT + i * CELL + CELL / 2}
                  y={10}
                  fontSize={9}
                  fill={axisLabel}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              ))}

              {/* Grid + risk markers */}
              {IMPACT_LEVELS.map((_, col) =>
                PROB_LABELS.map((_, row) => {
                  const x = LEFT + col * CELL;
                  const y = TOP + row * CELL;
                  const cellRisks = risks.filter(
                    (r) => impactIndex(r.impact) === col && probRow(r.probability) === row
                  );
                  const worst = cellRisks.length
                    ? cellRisks.reduce((a, b) => (severityRank(b.severity) > severityRank(a.severity) ? b : a))
                    : null;
                  return (
                    <React.Fragment key={`${col}-${row}`}>
                      <Rect
                        x={x}
                        y={y}
                        width={CELL - 2}
                        height={CELL - 2}
                        rx={4}
                        fill={worst ? SEVERITY_COLOR[worst.severity] : cellEmpty}
                        opacity={worst ? 0.85 : 1}
                      />
                      {cellRisks.length > 0 && (
                        <Circle cx={x + (CELL - 2) / 2} cy={y + (CELL - 2) / 2} r={3} fill="#ffffff" opacity={0.9} />
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {/* Row headers (Probability) */}
              {PROB_LABELS.map((label, row) => (
                <SvgText
                  key={`hy-${row}`}
                  x={LEFT - 4}
                  y={TOP + row * CELL + CELL / 2 + 3}
                  fontSize={9}
                  fill={axisLabel}
                  textAnchor="end"
                >
                  {label}
                </SvgText>
              ))}

              {/* Legend dots */}
              <Circle cx={LEFT + 10} cy={TOP + H + 16} r={4} fill={R.green} />
              <SvgText x={LEFT + 18} y={TOP + H + 20} fontSize={9} fill="#60646C">
                Low
              </SvgText>
              <Circle cx={LEFT + 60} cy={TOP + H + 16} r={4} fill={R.amber} />
              <SvgText x={LEFT + 68} y={TOP + H + 20} fontSize={9} fill="#60646C">
                Med
              </SvgText>
              <Circle cx={LEFT + 108} cy={TOP + H + 16} r={4} fill={R.red} />
              <SvgText x={LEFT + 116} y={TOP + H + 20} fontSize={9} fill="#60646C">
                High
              </SvgText>
            </Svg>
          </View>
        </ScrollView>
      </Card>
    </Section>
  );
}

/* ── 5. Financial Stress Test ── */
function FinancialStressTest({ riskData }: { riskData: RiskData }) {
  if (riskData.scenarios.length === 0) return null;

  return (
    <Section title="Financial Stress Test" subtitle="How the business holds up under revenue loss / cost shock">
      <View style={styles.stressGrid}>
        {riskData.scenarios.map((s, i) => {
          const healthy = s.netCashFlow >= 0;
          return (
            <Card key={i} style={[styles.scenarioCard, { borderLeftColor: healthy ? R.green : R.red, borderLeftWidth: 3 }]}>
              <View style={styles.scenarioHeader}>
                <ThemedText type="smallBold" themeColor="text">
                  {s.name}
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
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={valueTone}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ── 6. Cash Flow / Profitability (12-month SVG chart) ── */
function CashFlowSection({ riskData }: { riskData: RiskData }) {
  const theme = useTheme();
  const gridColor = theme.background === '#000000' ? '#2E3135' : '#E0E1E6';
  const series = useMemo(() => buildCashFlowSeries(riskData), [riskData]);
  const W = Math.min(SCREEN_WIDTH - 64, 340);
  const H = 180;
  const PAD = { top: 16, right: 10, bottom: 26, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = series.flatMap((s) => [s.revenue, s.expenses, s.net]);
  const max = Math.max(...allVals.map((v) => Math.abs(v))) * 1.1 || 1;
  const min = Math.min(...allVals.map((v) => Math.abs(v))) * -1.1;
  const yMin = Math.min(min, -max * 0.05);
  const yMax = max;

  const xAt = (i: number) => PAD.left + (innerW * i) / Math.max(series.length - 1, 1);
  const yAt = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const revenuePts = series.map((s, i) => `${xAt(i)},${yAt(s.revenue)}`).join(' ');
  const netPts = series.map((s, i) => `${xAt(i)},${yAt(s.net)}`).join(' ');

  const gridLines = [0.25, 0.5, 0.75, 1].map((t) => {
    const y = PAD.top + innerH - t * innerH;
    const val = yMin + (yMax - yMin) * t;
    return { y, val };
  });

  return (
    <Section title="Cash Flow & Profitability" subtitle="12-month revenue, expenses and net cash flow projection">
      <Card>
        <Svg width={W} height={H}>
          {/* Grid + Y labels */}
          {gridLines.map((g, i) => (
            <React.Fragment key={i}>
              <Line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke={gridColor} strokeWidth={1} />
              <SvgText x={PAD.left - 6} y={g.y + 3} fontSize={9} fill="#60646C" textAnchor="end">
                {compactINR(g.val)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Zero baseline */}
          <Line x1={PAD.left} y1={yAt(0)} x2={W - PAD.right} y2={yAt(0)} stroke={R.slate} strokeWidth={1.5} strokeDasharray="4 3" />

          {/* Revenue area */}
          <Polygon
            points={`${PAD.left},${yAt(0)} ${revenuePts} ${PAD.left + innerW},${yAt(0)}`}
            fill={R.greenSoft}
            stroke="none"
          />
          <Polyline points={revenuePts} fill="none" stroke={R.green} strokeWidth={2.5} />

          {/* Net cash flow line */}
          <Polyline points={netPts} fill="none" stroke={R.amber} strokeWidth={2.5} />

          {/* X labels */}
          {series.map((s, i) =>
            i % 2 === 0 ? (
              <SvgText key={i} x={xAt(i)} y={H - 8} fontSize={9} fill="#60646C" textAnchor="middle">
                {s.month}
              </SvgText>
            ) : null
          )}
        </Svg>

        {/* Legend */}
        <View style={styles.chartLegend}>
          <LegendDot color={R.green} label="Revenue" />
          <LegendDot color={R.amber} label="Net cash flow" />
          <LegendDot color={R.slate} label="Break-even line" />
        </View>
      </Card>
    </Section>
  );
}

/* ── 7. Break-even Analysis ── */
function BreakEvenSection({ riskData }: { riskData: RiskData }) {
  const { monthlyRevenue, breakEvenRevenue, netCashFlow, safetyMargin } = riskData.financials;
  const ratio = breakEvenRevenue > 0 ? monthlyRevenue / breakEvenRevenue : 1;
  const reached = monthlyRevenue >= breakEvenRevenue;
  const W = Math.min(SCREEN_WIDTH - 64, 340);

  return (
    <Section title="Break-even Analysis" subtitle="Revenue required to cover all fixed + variable costs">
      <Card>
        <View style={styles.beRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="small" themeColor="textSecondary">
              Current revenue
            </ThemedText>
            <ThemedText type="default" themeColor="text" style={{ fontWeight: '700' }}>
              {formatINR(monthlyRevenue)}
            </ThemedText>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <ThemedText type="small" themeColor="textSecondary">
              Break-even
            </ThemedText>
            <ThemedText type="default" themeColor={reached ? 'textSuccess' : 'textError'} style={{ fontWeight: '700' }}>
              {formatINR(breakEvenRevenue)}
            </ThemedText>
          </View>
        </View>

        {/* Meter: where current revenue sits vs break-even */}
        <View style={styles.beMeter}>
          <View
            style={[
              styles.beMeterFill,
              { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: reached ? R.green : R.amber },
            ]}
          />
          <View style={[styles.beMeterMark, { left: '100%' }]} />
        </View>
        <View style={styles.beLabels}>
          <Text style={styles.beLabelText}>0</Text>
          <Text style={styles.beLabelText}>{formatINR(breakEvenRevenue)}</Text>
          <Text style={styles.beLabelText}>{formatINR(Math.max(monthlyRevenue, breakEvenRevenue) * 1.1)}</Text>
        </View>

        <View style={styles.beStatsRow}>
          <StatPill label="Safety margin" value={formatINR(safetyMargin)} positive={safetyMargin >= 0} />
          <StatPill label="Monthly net flow" value={formatINR(netCashFlow)} positive={netCashFlow >= 0} />
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

/* ── 8. Risk Contribution by Category ── */
function RiskContribution({ riskData }: { riskData: RiskData }) {
  const contributions = useMemo(() => {
    const acc: Record<string, number> = {};
    riskData.risks.forEach((r) => {
      const weight = severityRank(r.severity) * r.probability;
      acc[r.category] = (acc[r.category] || 0) + weight;
    });
    const entries = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const maxScore = Math.max(...entries.map(([, v]) => v), 1);
    return entries.map(([name, score]) => ({ name, score, pct: (score / maxScore) * 100 }));
  }, [riskData]);

  if (contributions.length === 0) return null;

  return (
    <Section title="Risk Contribution by Category" subtitle="Which category drives the most overall risk">
      <Card>
        {contributions.map((c, i) => (
          <View key={i} style={styles.contributionRow}>
            <ThemedText type="small" themeColor="textSecondary" style={{ width: 96 }}>
              {c.name}
            </ThemedText>
            <View style={styles.contributionBar}>
              <View
                style={[styles.contributionFill, { width: `${c.pct}%`, backgroundColor: categoryColor(c.name) }]}
              />
            </View>
            <ThemedText type="smallBold" themeColor="text" style={{ width: 48, textAlign: 'right' }}>
              {c.score.toFixed(1)}
            </ThemedText>
          </View>
        ))}
      </Card>
    </Section>
  );
}

/* ── 9. What-If Simulator ── */
function WhatIfSimulator({ riskData }: { riskData: RiskData }) {
  const f = riskData.financials;
  // Defaults derived from the report's financials; replaced by real baseInputs when the
  // transform supplies them (they come from the user's business plan inputs).
  const fallback = {
    pricePerUnit: f.monthlyRevenue > 0 ? f.monthlyRevenue / (f.monthlyRevenue / 40 || 100) : 40,
    costPerUnit: 18,
    salesPerMonth: f.monthlyRevenue / 40 || 100,
    monthlyFixed: 4000,
    personalCost: 8000,
    setupCost: 95000,
    loanAmount: 47500,
    interestRatePercent: 12,
    loanTenureMonths: 24,
  };
  const base = riskData.baseInputs ?? fallback;

  const [price, setPrice] = useState(base.pricePerUnit);
  const [cost, setCost] = useState(base.costPerUnit);
  const [sales, setSales] = useState(base.salesPerMonth);
  const [fixed, setFixed] = useState(base.monthlyFixed);
  const [loan, setLoan] = useState(base.loanAmount);

  const sim = useMemo(() => {
    const revenue = sales * price;
    const variable = sales * cost;
    const expenses = variable + fixed;
    const r = (base.interestRatePercent || 12) / 12 / 100;
    const emi = loan > 0 && base.loanTenureMonths > 0
      ? (loan * r * Math.pow(1 + r, base.loanTenureMonths)) / (Math.pow(1 + r, base.loanTenureMonths) - 1)
      : 0;
    const net = revenue - expenses - emi;
    const breakEven = expenses + emi;
    const margin = revenue > 0 ? net / revenue : 0;
    return { revenue, expenses, emi, net, breakEven, margin };
  }, [price, cost, sales, fixed, loan, base]);

  const healthy = sim.net >= 0;

  return (
    <Section title="What-If Simulator" subtitle="Drag the sliders to stress-test your plan">
      <Card>
        <View style={styles.simSummary}>
          <StatPill label="Projected revenue" value={formatINR(sim.revenue)} positive />
          <StatPill label="Net cash flow" value={formatINR(sim.net)} positive={healthy} />
          <StatPill label="Break-even" value={formatINR(sim.breakEven)} positive={sim.revenue >= sim.breakEven} />
        </View>

        <SimSlider label="Selling price / unit" value={price} min={5} max={200} step={1} onChange={setPrice} prefix="₹" />
        <SimSlider label="Cost / unit" value={cost} min={1} max={150} step={1} onChange={setCost} prefix="₹" />
        <SimSlider label="Units sold / month" value={sales} min={50} max={5000} step={50} onChange={setSales} />
        <SimSlider label="Monthly fixed costs" value={fixed} min={0} max={50000} step={500} onChange={setFixed} prefix="₹" />
        <SimSlider label="Loan amount" value={loan} min={0} max={2000000} step={10000} onChange={setLoan} prefix="₹" />

        <View style={[styles.simVerdict, { backgroundColor: healthy ? R.greenSoft : R.redSoft }]}>
          <ThemedText type="smallBold" themeColor={healthy ? 'textSuccess' : 'textError'}>
            {healthy
              ? '✓ Viable at these settings — positive net cash flow'
              : '✗ Stress point — net cash flow turns negative'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Net margin {Math.round(sim.margin * 100)}% · Break-even{' '}
            {sim.revenue >= sim.breakEven ? 'achieved' : `needs ${formatINR(sim.breakEven - sim.revenue)} more`}
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
  prefix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.simSliderRow}>
      <View style={styles.simSliderHeader}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="text">
          {prefix ?? ''}{value.toLocaleString('en-IN')}
        </ThemedText>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        minimumTrackTintColor={R.green}
        maximumTrackTintColor={theme.backgroundSelected}
        thumbTintColor={R.green}
        style={{ width: '100%', height: 36 }}
      />
    </View>
  );
}

/* ── 10. GO / CAUTION / NO-GO ── */
function RecommendationCard({ riskData }: { riskData: RiskData }) {
  const { decision, rationale, supportingPoints, actionItems } = riskData.recommendation;
  const stylesByDecision = {
    GO: { bg: R.greenSoft, border: R.green, text: R.green },
    CAUTION: { bg: R.amberSoft, border: R.amber, text: R.amber },
    'NO-GO': { bg: R.redSoft, border: R.red, text: R.red },
  }[decision];

  return (
    <Section title="Final Recommendation" subtitle="The verdict — GO, CAUTION or NO-GO">
      <View style={[styles.recommendationCard, { backgroundColor: stylesByDecision.bg, borderColor: stylesByDecision.border }]}>
        <Text style={[styles.recommendationBadge, { color: stylesByDecision.text, borderColor: stylesByDecision.border }]}>
          {decision}
        </Text>
        <ThemedText type="small" style={{ textAlign: 'center', marginTop: Spacing.two, color: '#3E2723' }}>
          {rationale}
        </ThemedText>

        {supportingPoints.length > 0 && (
          <View style={styles.recoColumn}>
            <ThemedText type="smallBold" style={{ color: '#3E2723' }}>
              Why?
            </ThemedText>
            {supportingPoints.map((p, i) => {
              // Quick fix for long decimals in the backend strings
              const formattedP = p.replace(/(\d+\.\d{3})\d+(%)/g, '$1$2');
              return (
                <ThemedText key={i} type="small" style={[styles.recoBullet, { color: '#5D4037' }]}>
                  • {formattedP}
                </ThemedText>
              );
            })}
          </View>
        )}

        {actionItems.length > 0 && (
          <View style={styles.recoColumn}>
            <ThemedText type="smallBold" style={{ color: '#3E2723' }}>
              What would make this safer?
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

/* ── 11. Explainability / Evidence ── */
function Explainability({ riskData }: { riskData: RiskData }) {
  const nRisks = riskData.risks.length;
  const nScenarios = riskData.scenarios.length;
  return (
    <Section title="Why does it say this?" subtitle="Evidence & traceability behind the verdict">
      <Card>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
          This report is generated by a multi-agent risk pipeline that evaluates market, financial and operational
          signals together. The key drivers:
        </ThemedText>
        <View style={styles.evidenceGrid}>
          <EvidenceRow label="Market analysis" value={`${riskData.marketRisk * 100}% market risk score`} />
          <EvidenceRow label="Stress scenarios" value={`${nScenarios} scenarios tested (baseline → severe)`} />
          <EvidenceRow label="Risk register" value={`${nRisks} risks quantified`} />
          <EvidenceRow label="Viability" value={`${Math.round(riskData.businessViabilityScore * 100)}% confidence`} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two, fontStyle: 'italic' }}>
          Scores are normalized 0–100. A higher risk score means more caution is warranted before taking on debt.
        </ThemedText>
      </Card>
    </Section>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.evidenceRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ width: 120 }}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor="text" style={{ flex: 1 }}>
        {value}
      </ThemedText>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Shared helpers
 * ──────────────────────────────────────────────────────────── */

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
    case 'Critical': return 'textError';
    case 'High': return 'textError';
    case 'Medium': return 'textWarning';
    default: return 'textSuccess';
  }
}

function impactHex(impact: 'Low' | 'Medium' | 'High'): string {
  switch (impact) {
    case 'High': return R.red;
    case 'Medium': return R.amber;
    default: return R.green;
  }
}

function impactSoft(impact: 'Low' | 'Medium' | 'High'): string {
  switch (impact) {
    case 'High': return R.redSoft;
    case 'Medium': return R.amberSoft;
    default: return R.greenSoft;
  }
}

function categoryColor(category: string): string {
  const colors = [R.green, R.amber, R.red, '#3F6653', '#8E4E14'];
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** Compact INR label for chart axes: 1.2L, 45K, 800. */
function compactINR(n: number): string {
  const a = Math.abs(n);
  if (a >= 100000) return `${(n / 100000).toFixed(a >= 1000000 ? 0 : 1)}L`;
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

/** Build a 12-month cash-flow projection from the report's financials + base inputs. */
function buildCashFlowSeries(riskData: RiskData): { month: string; revenue: number; expenses: number; net: number }[] {
  const f = riskData.financials;
  const base = riskData.baseInputs;

  const months: { month: string; revenue: number; expenses: number; net: number }[] = [];
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 12; i++) {
    // Ramp revenue from 82% → 112% of current monthly revenue (typical micro-enterprise ramp).
    const ramp = 0.82 + (i / 11) * 0.3;
    const revenue = f.monthlyRevenue * ramp;

    // Costs drift slightly upward; EMI constant.
    const expenses = f.monthlyExpenses * (1 + i * 0.004);
    const net = revenue - expenses - f.loanEMI;

    const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ month: MONTHS[m.getMonth()], revenue, expenses, net });
  }
  return months;
}

/* ────────────────────────────────────────────────────────────
 *  Styles
 * ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionHeading: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: Spacing.half,
    color: '#3E2723', // Dark brown
  },
  sectionSub: {
    marginBottom: Spacing.two,
    color: '#5D4037', // Medium brown
  },
  card: {
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
  },
  emptyState: {
    padding: Spacing.five,
    borderRadius: 16,
    alignItems: 'center',
  },

  /* Skeleton */
  skeletonWrap: {
    gap: Spacing.three,
  },
  skeletonBlock: {
    backgroundColor: 'rgba(150,150,150,0.18)',
    borderRadius: 12,
  },

  /* Executive summary */
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  summaryGaugeCard: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMetrics: {
    flex: 1,
    gap: Spacing.two,
  },
  metricChip: {
    borderRadius: 10,
    padding: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* Top risks */
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

  /* SWOT */
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
  impactPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    marginTop: 2,
  },
  impactPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Stress test */
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

  /* Charts */
  chartLegend: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
    justifyContent: 'center',
  },

  /* Break-even */
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
  beLabelText: {
    fontSize: 10,
    color: '#60646C',
  },
  beStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  statPill: {
    flex: 1,
    borderRadius: 10,
    padding: Spacing.two,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
  },

  /* Contribution */
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  contributionBar: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginHorizontal: Spacing.two,
    overflow: 'hidden',
  },
  contributionFill: {
    height: '100%',
    borderRadius: 5,
  },

  /* Simulator */
  simSummary: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  simSliderRow: {
    marginBottom: Spacing.one,
  },
  simSliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simVerdict: {
    marginTop: Spacing.two,
    borderRadius: 10,
    padding: Spacing.two,
    alignItems: 'center',
  },

  /* Recommendation */
  recommendationCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: Spacing.four,
    alignItems: 'center',
  },
  recommendationBadge: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  recoColumn: {
    width: '100%',
    marginTop: Spacing.three,
  },
  recoBullet: {
    marginTop: Spacing.half,
  },

  /* Evidence */
  evidenceGrid: {
    gap: Spacing.one,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  /* Mobile Risk Register styles */
  riskCardList: {
    gap: Spacing.two,
  },
  mobileRiskCard: {
    padding: Spacing.two,
    borderRadius: 14,
    marginBottom: Spacing.one,
  },
  mobileRiskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  mobileCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(150,150,150,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  severityPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mobileRiskStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(150,150,150,0.06)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: Spacing.one,
    justifyContent: 'space-between',
  },
  mobileRiskStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  statMiniLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statMiniValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  mobileMitigationBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99,153,34,0.08)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    alignItems: 'flex-start',
    gap: 6,
  },
  mitigationShieldIcon: {
    fontSize: 14,
    marginTop: 1,
  },
});

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: theme.textSecondary }}>{label}</Text>
    </View>
  );
}
