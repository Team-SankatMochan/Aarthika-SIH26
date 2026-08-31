import { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../model';
import Profile from '../../model/profile';
import {
  analyseProject,
  recalculateWithDisaster,
  formatINR,
  tierLabel,
  type ProjectResult,
} from '../../engine/financials';
import { GoNoGoGauge } from '../../components/GoNoGoGauge';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { FinancialCard } from '@/components/FinancialCard';
import { RiskIndicator } from '@/components/RiskIndicator';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { BUSINESS_ICONS, TIER_BADGES } from '@/constants/icons';

interface DashboardScreenProps {
  profile: Profile;
}

function DashboardScreen({ profile }: DashboardScreenProps) {
  const theme = useTheme();
  const [disasterImpact, setDisasterImpact] = useState(0);

  // Calculate initial project analysis
  const baseResult: ProjectResult = useMemo(() => {
    if (!profile) return null as any;
    return analyseProject(profile.getProjectInputs());
  }, [profile?.capital, profile?.cityKey, profile?.businessTypeKey]);

  // Recalculate with disaster impact
  const liveResult = useMemo(() => {
    if (!baseResult) return null;
    return recalculateWithDisaster(baseResult, disasterImpact, profile.capital);
  }, [baseResult, disasterImpact, profile?.capital]);

  if (!profile || !baseResult) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0274DF" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.loadingText}>
            Loading profile...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const tierBadge = TIER_BADGES[baseResult.tier];
  const businessIcon = BUSINESS_ICONS[profile.businessTypeKey] || BUSINESS_ICONS.other;

  // Risk components for breakdown
  const monthlyIncome = (baseResult.totalProjectCost * baseResult.marginPercent) / 12;
  const emiRatio = liveResult ? Math.min(liveResult.emi / monthlyIncome, 1) : 0;
  const disasterRisk = baseResult.disasterRisk * (1 + disasterImpact);
  const businessRisk = (baseResult.businessRiskFactor - 0.7) / 0.6;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section - Profile Summary */}
        <View style={styles.heroSection}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitle}>
              <ThemedText type="title" style={styles.heroBusinessName}>
                {businessIcon} {baseResult.business.label}
              </ThemedText>
              <View style={styles.locationRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {tierBadge.icon} {baseResult.city.name}, {baseResult.city.state}
                </ThemedText>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: tierBadge.color + '20', borderColor: tierBadge.color },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={[styles.tierBadgeText, { color: tierBadge.color }]}
                  >
                    {tierLabel(baseResult.tier)}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.capitalCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              },
            ]}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Your Margin Capital
            </ThemedText>
            <ThemedText type="subtitle" style={styles.capitalAmount}>
              {profile.getDisplayCapital()}
            </ThemedText>
          </View>
        </View>

        {/* Financial Summary Cards */}
        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Financial Summary
          </ThemedText>
          <View style={styles.cardGrid}>
            <View style={styles.cardHalf}>
              <FinancialCard
                title="Total Project Cost"
                value={formatINR(baseResult.totalProjectCost)}
                subtitle={`${(baseResult.marginPercent * 100).toFixed(0)}% margin • ${
                  baseResult.tier
                } multiplier`}
                icon="💰"
              />
            </View>
            <View style={styles.cardHalf}>
              <FinancialCard
                title="Loan Required"
                value={formatINR(liveResult?.adjustedLoan || baseResult.loanAmount)}
                subtitle={
                  disasterImpact > 0
                    ? `+${(disasterImpact * 100).toFixed(0)}% disaster buffer`
                    : 'Base amount'
                }
                icon="🏦"
              />
            </View>
          </View>
          <FinancialCard
            title="Monthly EMI"
            value={formatINR(liveResult?.emi || baseResult.emi)}
            subtitle={`${baseResult.interestRate.toFixed(1)}% interest • ${
              baseResult.tenureMonths
            } months tenure`}
            icon="📅"
            variant="prominent"
          />
        </View>

        {/* Disaster Impact Slider */}
        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Disaster Impact Scenario
          </ThemedText>
          <View
            style={[
              styles.sliderCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              },
            ]}
          >
            <View style={styles.sliderHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                Adjust disaster impact
              </ThemedText>
              <ThemedText type="smallBold" style={styles.sliderValue}>
                {(disasterImpact * 100).toFixed(0)}%
              </ThemedText>
            </View>
            <Slider
              value={disasterImpact}
              onValueChange={setDisasterImpact}
              minimumValue={0}
              maximumValue={1}
              minimumTrackTintColor="#639922"
              maximumTrackTintColor="#E24B4A"
              thumbTintColor={theme.text}
              style={styles.slider}
            />
            <View style={styles.sliderLabels}>
              <ThemedText type="small" themeColor="textSecondary">
                No impact
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Severe impact
              </ThemedText>
            </View>

            {disasterImpact > 0 && (
              <View style={styles.emiComparison}>
                <View style={styles.emiCompareRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Base EMI:
                  </ThemedText>
                  <ThemedText type="small">{formatINR(baseResult.emi)}</ThemedText>
                </View>
                <View style={styles.emiCompareRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Adjusted EMI:
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#E24B4A' }}>
                    {formatINR(liveResult?.emi || baseResult.emi)}
                  </ThemedText>
                </View>
                <View style={styles.emiCompareRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Increase:
                  </ThemedText>
                  <ThemedText type="small" style={{ color: '#E24B4A' }}>
                    +{formatINR((liveResult?.emi || baseResult.emi) - baseResult.emi)}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Go/No-Go Gauge */}
        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Project Viability Assessment
          </ThemedText>
          <View style={styles.gaugeContainer}>
            <GoNoGoGauge
              riskRatio={liveResult?.riskRatio || baseResult.riskRatio}
              size={280}
              showLabels={true}
              showPercentage={true}
              animated={true}
            />
          </View>
        </View>

        {/* Risk Breakdown */}
        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Risk Factor Breakdown
          </ThemedText>
          <View
            style={[
              styles.riskCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              },
            ]}
          >
            <RiskIndicator label="EMI Affordability" value={emiRatio} />
            <RiskIndicator label="Location Disaster Risk" value={Math.min(disasterRisk, 1)} />
            <RiskIndicator label="Business Sector Risk" value={Math.max(businessRisk, 0)} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.riskNote}>
            💡 Risk scores below 40% indicate viable projects. Scores above 70% require careful
            reconsideration.
          </ThemedText>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ThemedView>
  );
}

// WatermelonDB HOC to observe the profile
const Enhanced = withObservables(['profileId'], ({ profileId }: { profileId: string }) => ({
  profile: database.get<Profile>('profiles').findAndObserve(profileId),
}))(DashboardScreen);

export default function DashboardRoute() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  if (!profileId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <ThemedText type="subtitle">⚠️ Profile not found</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            Please go back and create a new profile.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return <Enhanced profileId={profileId} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.three,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  errorText: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  heroSection: {
    marginBottom: Spacing.five,
  },
  heroHeader: {
    marginBottom: Spacing.three,
  },
  heroTitle: {
    gap: Spacing.one,
  },
  heroBusinessName: {
    fontSize: 32,
    lineHeight: 38,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  tierBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  capitalCard: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  capitalAmount: {
    marginTop: Spacing.one,
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    marginBottom: Spacing.three,
    fontSize: 16,
  },
  cardGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  cardHalf: {
    flex: 1,
  },
  sliderCard: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sliderValue: {
    fontSize: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  emiComparison: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    gap: Spacing.one,
  },
  emiCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  riskCard: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
  riskNote: {
    marginTop: Spacing.two,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: Spacing.four,
  },
});
