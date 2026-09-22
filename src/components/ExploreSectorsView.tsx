import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SECTOR_CATALOG, SectorItem } from '../constants/sectors';

interface ExploreSectorsViewProps {
  currentLang: string;
  t: (key: string) => string;
  onSelectSector: (sector: SectorItem) => void;
  onBack: () => void;
}

export const ExploreSectorsView: React.FC<ExploreSectorsViewProps> = ({
  currentLang,
  t,
  onSelectSector,
  onBack,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { key: 'all', label: t('cat_all') || 'All' },
    { key: 'agri', label: t('cat_agri') || 'Agriculture & Livestock' },
    { key: 'retail', label: t('cat_retail') || 'Retail & Commerce' },
    { key: 'services', label: t('cat_services') || 'Services & Trades' },
    { key: 'manufacturing', label: t('cat_manufacturing') || 'Food & Crafts' },
  ];

  const filteredSectors = useMemo(() => {
    return SECTOR_CATALOG.filter((sector) => {
      const matchesCategory =
        selectedCategory === 'all' || sector.category === selectedCategory;

      const title = t(sector.titleKey) || sector.id;
      const sub = t(sector.subKey) || '';
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !q ||
        title.toLowerCase().includes(q) ||
        sub.toLowerCase().includes(q) ||
        sector.id.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, t]);

  const formatINR = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Header & Back Button */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backButtonText}>{t('back_to_home') || '← Back to Home'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.title}>{t('explore_sectors_title') || 'Explore Business Sectors'}</Text>
        <Text style={styles.subtitle}>
          {t('explore_sectors_sub') || 'Choose a validated business model for your village or town'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_sectors_placeholder') || 'Search sectors (e.g. Kirana, Dairy, Tailoring)...'}
          placeholderTextColor="#867468"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Text style={{ fontSize: 13, color: '#867468' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryPillsContainer}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryPill, isActive && styles.activeCategoryPill]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.categoryPillText, isActive && styles.activeCategoryPillText]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sectors Grid */}
      <View style={styles.grid}>
        {filteredSectors.map((sector) => {
          const setupCost = sector.presets.setupCost;
          const monthlyRevenue = sector.presets.salesPerMonth * sector.presets.pricePerUnit;
          const monthlyVariable = sector.presets.salesPerMonth * sector.presets.costPerUnit;
          const monthlyProfit = monthlyRevenue - monthlyVariable - sector.presets.monthlyFixed - sector.presets.personalCost;

          return (
            <View key={sector.id} style={styles.sectorCard}>
              <View style={styles.cardTop}>
                <View style={styles.iconCircle}>
                  <Text style={{ fontSize: 28 }}>{sector.icon}</Text>
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardTitle}>{t(sector.titleKey)}</Text>
                  <Text style={styles.cardSub}>{t(sector.subKey)}</Text>
                </View>
              </View>

              {/* Financial metric tags */}
              <View style={styles.metricsRow}>
                <View style={styles.metricBadge}>
                  <Text style={styles.metricLabel}>{t('setup_cost_tag') || 'Setup'}</Text>
                  <Text style={styles.metricValuePrimary}>{formatINR(setupCost)}</Text>
                </View>

                <View style={[styles.metricBadge, { backgroundColor: '#e2f4ea' }]}>
                  <Text style={[styles.metricLabel, { color: '#2d6a4f' }]}>
                    {t('monthly_roi_tag') || 'Est. Profit'}
                  </Text>
                  <Text style={[styles.metricValueSecondary, { color: monthlyProfit >= 0 ? '#2d6a4f' : '#ba1a1a' }]}>
                    {formatINR(monthlyProfit)}/mo
                  </Text>
                </View>
              </View>

              {/* Select CTA */}
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => onSelectSector(sector)}
                activeOpacity={0.8}
              >
                <Text style={styles.selectButtonText}>
                  {t('select_sector') || 'Select Sector'} →
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {filteredSectors.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 36 }}>🔍</Text>
            <Text style={styles.emptyTitle}>No matching sectors found</Text>
            <Text style={styles.emptySub}>Try searching with a different keyword or category.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 90,
  },
  headerRow: {
    marginBottom: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#efeee3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e4e14',
  },
  titleSection: {
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#8e4e14',
  },
  subtitle: {
    fontSize: 13,
    color: '#534439',
    marginTop: 4,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(216, 194, 181, 0.5)',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1b1c15',
  },
  clearBtn: {
    padding: 4,
  },
  categoryPillsContainer: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#efeee3',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCategoryPill: {
    backgroundColor: '#014737',
    borderColor: '#014737',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#534439',
  },
  activeCategoryPillText: {
    color: '#ffffff',
  },
  grid: {
    gap: 12,
  },
  sectorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.4)',
    shadowColor: '#8e4e14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f4e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b1c15',
  },
  cardSub: {
    fontSize: 11,
    color: '#3f6653',
    marginTop: 2,
    lineHeight: 15,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricBadge: {
    flex: 1,
    backgroundColor: '#f5f4e8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#867468',
    textTransform: 'uppercase',
  },
  metricValuePrimary: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8e4e14',
    marginTop: 2,
  },
  metricValueSecondary: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3f6653',
    marginTop: 2,
  },
  selectButton: {
    backgroundColor: '#f4a261',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6f3800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#534439',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#867468',
    marginTop: 4,
    textAlign: 'center',
  },
});
