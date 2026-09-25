/**
 * AARTHIKA - Mobile Application (React Native / Expo)
 * "Clarity Before Credit"
 */

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { api } from '../services/api';
import { speak, stopSpeaking } from '../services/tts';
import { sttService } from '../services/stt';
import { AARTHIKA_TRANSLATIONS } from '../constants/translations';
import { SECTOR_CATALOG, SectorItem } from '../constants/sectors';
import { PopularSectorCard } from '../components/PopularSectorCard';
import { ExploreSectorsView } from '../components/ExploreSectorsView';
import { NumericVoiceModal } from '../components/NumericVoiceModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Image,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { GoNoGoGauge } from '../../components/GoNoGoGauge';
import { RiskAnalysisDashboard } from '../components/RiskAnalysisDashboard';
import RuralInterviewScreen from './rural-interview';

// App logo and sector images
const APP_LOGO = require('../../assets/images/logo.png');
const SECTOR_IMAGES = {
  farming: require('../../assets/images/sector_farming.jpg'),
  poultry: require('../../assets/images/sector_poultry.jpg'),
  goat: require('../../assets/images/sector_goat.jpg'),
  dairy: require('../../assets/images/sector_dairy.jpg'),
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(280, SCREEN_WIDTH * 0.72);
const SNAP_INTERVAL = CARD_WIDTH + 14;

// Make translations globally accessible
const _tGlobal: any = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
_tGlobal.AARTHIKA_TRANSLATIONS = AARTHIKA_TRANSLATIONS;

// Shared helper: map in-memory activeBusiness plan to backend schema
function buildAssumptionsPayload(biz: any, businessId: string): Record<string, unknown> {
  const setupCost = biz?.setupCost;
  const monthlyFixed = biz?.monthlyFixed;
  const pricePerUnit = biz?.pricePerUnit;
  const costPerUnit = biz?.costPerUnit;
  const salesPerMonth = biz?.salesPerMonth;
  const personalCost = biz?.personalCost;

  return {
    business_id: businessId,
    expected_customers: Math.max(1, Math.round(salesPerMonth / 30)),
    selling_price: pricePerUnit,
    production_volume: salesPerMonth,
    raw_material_cost: costPerUnit,
    labour_cost: personalCost,
    rent: Math.round(monthlyFixed * 0.4),
    transport_cost: Math.round(monthlyFixed * 0.3),
    working_capital: Math.round(setupCost * 0.3),
    proposed_loan_amount: Math.round(setupCost * 0.5),
    other_operating_cost: Math.round(monthlyFixed * 0.3),
    assumption_source: 'ENTREPRENEUR',
    confidence: 0.75,
  };
}

// Theme Colors matching Stitch approved palette
export const COLORS = {
  primary: '#8e4e14',
  primaryContainer: '#f4a261',
  onPrimaryContainer: '#6f3800',
  onPrimary: '#ffffff',
  secondary: '#3f6653',
  secondaryContainer: '#beead1',
  onSecondaryContainer: '#436b58',
  onSecondary: '#ffffff',
  tertiary: '#924c00',
  tertiaryContainer: '#fb9f54',
  surface: '#fbfaee',
  background: '#fbfaee',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f4e8',
  surfaceContainer: '#efeee3',
  surfaceContainerHigh: '#e9e9dd',
  surfaceVariant: '#e4e3d7',
  onSurface: '#1b1c15',
  onSurfaceVariant: '#534439',
  outline: '#867468',
  outlineVariant: '#d8c2b5',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  deepForest: '#014737',
  navActive: '#014737',
};

const AppContext = createContext({
  currentLang: 'en',
  setCurrentLang: (lang: string) => {},
  currentScreen: 'signup',
  navigateTo: (screen: string) => {},
  user: {
    fullName: '',
    firstName: '',
    lastName: '',
    mobile: '',
    age: '',
    state: '',
    district: '',
    village: '',
    occupation: '',
    interestedSector: '',
    hasExistingBusiness: '',
    profileImage: null,
  },
  setUser: () => {},
  activeBusiness: {
    sector: '',
    title: '',
    setupCost: 0,
    monthlyFixed: 0,
    unitType: '',
    pricePerUnit: 0,
    costPerUnit: 0,
    salesPerMonth: 0,
    personalCost: 0,
    breakdown: [],
  },
  setActiveBusiness: () => {},
  activeBusinessId: null,
  setActiveBusinessId: () => {},
  aiReport: null,
  setAiReport: () => {},
  isAuthenticated: false,
  handleSignup: () => {},
  handleLogin: () => {},
  handleLogout: () => {},
  t: (key: string) => key,
  setIsVoiceActive: () => {},
  setIsLangModalOpen: () => {},
});

export const useApp = () => useContext(AppContext);

export default function App() {
  const [currentLang, setCurrentLang] = useState('en');
  _tGlobal.currentLang = currentLang;
  const [currentScreen, setCurrentScreen] = useState('signup');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({
    fullName: '',
    firstName: '',
    lastName: '',
    mobile: '',
    age: '',
    state: '',
    district: '',
    village: '',
    occupation: '',
    interestedSector: '',
    hasExistingBusiness: '',
    profileImage: null,
  });

  // Hydrate persisted user on startup
  useEffect(() => {
    (async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
        const langJson = await AsyncStorage.getItem('@lang');
        if (langJson) {
          setCurrentLang(langJson);
        }
        if (userJson) {
          const parsed = JSON.parse(userJson);
          setUser(parsed);
          setIsAuthenticated(true);
          setCurrentScreen('home');
        }
      } catch (e) {
        console.warn('Could not load user from storage', e);
      }
    })();
  }, []);

  const [activeBusiness, setActiveBusiness] = useState({
    sector: '',
    title: '',
    setupCost: 0,
    monthlyFixed: 0,
    unitType: '',
    pricePerUnit: 0,
    costPerUnit: 0,
    salesPerMonth: 0,
    personalCost: 0,
    breakdown: [
      { label: 'Drip Irrigation & Land Prep', cost: 45000 },
      { label: 'Certified Seeds & Bio-Fertilizer', cost: 30000 },
      { label: 'Sprayer & Crates', cost: 20000 },
    ],
  });
  const [activeBusinessId, setActiveBusinessId] = useState(null);
  const [aiReport, setAiReport] = useState(null);

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  // Centralized translation lookup helper
  const t = (key: string): string => {
    const dict = AARTHIKA_TRANSLATIONS[currentLang] || AARTHIKA_TRANSLATIONS['en'];
    if (dict && dict[key] !== undefined) return dict[key];
    const enDict = AARTHIKA_TRANSLATIONS['en'];
    if (enDict && enDict[key] !== undefined) return enDict[key];
    return key;
  };

  const handleSetLanguage = async (lang: string) => {
    setCurrentLang(lang);
    setIsLangModalOpen(false);
    try {
      await AsyncStorage.setItem('@lang', lang);
    } catch (e) {
      console.warn('Failed to persist language', e);
    }
  };

  const navigateTo = (screen: string) => {
    setCurrentScreen(screen);
  };

  const handleSignup = async (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
    setCurrentScreen('home');
    try {
      await AsyncStorage.setItem('@user', JSON.stringify(userData));
    } catch (e) {
      console.warn('Failed to persist user on signup', e);
    }
  };

  const handleLogin = async (mobile?: string, password?: string) => {
    const updated = (prev: any) => ({
      ...prev,
      mobile: mobile || prev.mobile || '',
      fullName: prev.fullName || '',
      firstName: prev.firstName || '',
    });
    setUser(updated);
    setIsAuthenticated(true);
    setCurrentScreen('home');
    try {
      const current = await AsyncStorage.getItem('@user');
      const merged = current ? JSON.parse(current) : {};
      await AsyncStorage.setItem('@user', JSON.stringify({ ...merged, ...updated({}) }));
    } catch (e) {
      console.warn('Failed to persist user on login', e);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentScreen('login');
    setUser({
      fullName: '',
      firstName: '',
      lastName: '',
      mobile: '',
      age: '',
      state: '',
      district: '',
      village: '',
      occupation: '',
      interestedSector: '',
      hasExistingBusiness: '',
      profileImage: null,
    });
    try {
      AsyncStorage.removeItem('@user');
    } catch (e) {
      console.warn('Failed to clear user storage on logout', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentLang,
        setCurrentLang: handleSetLanguage,
        currentScreen,
        navigateTo,
        user,
        setUser,
        activeBusiness,
        setActiveBusiness,
        activeBusinessId,
        setActiveBusinessId,
        aiReport,
        setAiReport,
        isAuthenticated,
        handleSignup,
        handleLogin,
        handleLogout,
        t,
        setIsVoiceActive,
        setIsLangModalOpen,
      }}
    >
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'horizontal']}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

          {/* Mobile Header with Official Logo & Language Selector */}
          <MobileHeader />

          {/* Dynamic Screen Renderer */}
          <View style={styles.screenContainer}>
            {currentScreen === 'signup' && <SignUpScreen />}
            {currentScreen === 'login' && <LoginScreen />}
            {currentScreen === 'home' && <HomeScreen />}
            {currentScreen === 'my_plan' && <MyPlanScreen />}
            {currentScreen === 'risk_test' && <RiskTestScreen />}
            {currentScreen === 'profile' && <ProfileScreen />}
            {currentScreen === 'business_details' && <BusinessDetailsScreen />}
            {currentScreen === 'explore_sectors' && <ExploreSectorsScreen />}
            {currentScreen === 'sih_demo' && <RuralInterviewScreen />}
          </View>

          {/* Mobile Bottom Tab Navigation */}
          {isAuthenticated && currentScreen !== 'signup' && currentScreen !== 'login' && (
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.surfaceContainerLowest }}>
              <BottomTabBar currentScreen={currentScreen} onNavigate={navigateTo} t={t} />
            </SafeAreaView>
          )}

          {/* Universal Language Selection Modal (9 Languages) */}
          <LanguageModal
            isOpen={isLangModalOpen}
            onClose={() => setIsLangModalOpen(false)}
            currentLang={currentLang}
            onSelect={handleSetLanguage}
            t={t}
          />

          {/* Speak to Aarthika Voice Recognition Modal with Speech-to-Text */}
          <VoiceModal
            isOpen={isVoiceActive}
            onClose={() => setIsVoiceActive(false)}
            t={t}
            currentLang={currentLang}
            onTranscript={(text: string) => {
              setActiveBusiness((prev) => ({
                ...prev,
                title: text,
                sector: 'custom',
              }));
              setIsVoiceActive(false);
              setCurrentScreen('business_details');
            }}
          />
        </SafeAreaView>
      </View>
    </AppContext.Provider>
  );
}

// ----------------------------------------------------
// MOBILE HEADER COMPONENT WITH LOGO & LANGUAGE SELECTOR
// ----------------------------------------------------
function MobileHeader() {
  const { currentLang, setIsLangModalOpen, navigateTo, isAuthenticated } = useApp();

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी',
    bn: 'বাংলা',
    ml: 'മലയാളം',
    te: 'తెలుగు',
    pa: 'ਪੰਜਾਬੀ',
    kn: 'ಕನ್ನಡ',
    ur: 'اردو',
    bho: 'भोजपुरी',
  };

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.brandingContainer}
        onPress={() => (isAuthenticated ? navigateTo('home') : navigateTo('signup'))}
      >
        <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
      </Pressable>

      <TouchableOpacity
        style={styles.langSelectorBadge}
        onPress={() => setIsLangModalOpen(true)}
      >
        <Text style={styles.langSelectorBadgeText}>{langNames[currentLang] || 'English'} ▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----------------------------------------------------
// HOME SCREEN (POPULAR SECTORS POP-OUT / LIFT HOVER & FULL i18n)
// ----------------------------------------------------
function HomeScreen() {
  const { user, setIsVoiceActive, navigateTo, setActiveBusiness, t } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const [businessQuery, setBusinessQuery] = useState('');
  const carouselRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleTextSubmit = () => {
    if (businessQuery.trim().length > 0) {
      setActiveBusiness((prev) => ({ ...prev, title: businessQuery, sector: 'custom' }));
      navigateTo('business_details');
    }
  };

  // Popular sectors using SECTOR_CATALOG items + Action Card
  const popularSectors = SECTOR_CATALOG.filter((s) => s.isPopular);
  const CAROUSEL_INSET = Math.max(16, (Math.min(440, SCREEN_WIDTH) - CARD_WIDTH) / 2);

  const handleCardPress = (sector: SectorItem) => {
    setActiveBusiness({
      sector: sector.id,
      title: t(sector.titleKey) || sector.id,
      setupCost: sector.presets.setupCost,
      monthlyFixed: sector.presets.monthlyFixed,
      unitType: sector.presets.unitType,
      pricePerUnit: sector.presets.pricePerUnit,
      costPerUnit: sector.presets.costPerUnit,
      salesPerMonth: sector.presets.salesPerMonth,
      personalCost: sector.presets.personalCost,
      breakdown: sector.presets.breakdown,
    });
    navigateTo('business_details');
  };

  const scrollToCard = (index: number) => {
    const totalCount = popularSectors.length + 1;
    if (carouselRef.current && index >= 0 && index < totalCount) {
      carouselRef.current.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
      setActiveIndex(index);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. HERO GREETING CARD */}
      <View style={styles.heroGreetingCard}>
        <View style={styles.heroTaglineBadge}>
          <Text style={styles.heroTaglineText}>
            {(t('tagline') || 'Clarity Before Credit').toUpperCase()}
          </Text>
        </View>

        <Text style={styles.heroGreetingTitle}>
          {t('greeting_prefix') || 'Namaste'}, {user.firstName || 'Ramesh'} 🙏
        </Text>

        <Text style={styles.heroGreetingSub}>
          {t('home_question') || 'What business do you want to start or grow?'}
        </Text>
      </View>

      {/* 2. UNIFIED SEARCH & VOICE INPUT */}
      <View style={styles.searchVoiceSection}>
        <View style={styles.unifiedSearchBar}>
          <Text style={styles.searchBarIcon}>🔍</Text>
          <TextInput
            style={styles.unifiedSearchInput}
            placeholder={t('type_business_placeholder') || 'Type or speak your business idea...'}
            placeholderTextColor={COLORS.outline}
            value={businessQuery}
            onChangeText={setBusinessQuery}
            onSubmitEditing={handleTextSubmit}
            returnKeyType="search"
          />
          {businessQuery.trim().length > 0 ? (
            <TouchableOpacity style={styles.searchGoPill} onPress={handleTextSubmit} activeOpacity={0.8}>
              <Text style={styles.searchGoPillText}>{t('go_btn') || 'Go →'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.searchMicPill}
              onPress={() => setIsVoiceActive(true)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🎙️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Big Voice Hero CTA Card */}
        <TouchableOpacity
          style={styles.voiceHeroCard}
          onPress={() => setIsVoiceActive(true)}
          activeOpacity={0.88}
        >
          <View style={styles.voiceHeroMicWrap}>
            <Text style={{ fontSize: 24 }}>🎙️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.voiceHeroTitle}>{t('speak_to_aarthika') || 'Speak to Aarthika'}</Text>
            <Text style={styles.voiceHeroSub}>
              {t('home_subtext') || 'Just tell Aarthika in your language — no need to type.'}
            </Text>
          </View>
          <View style={styles.voiceHeroArrowWrap}>
            <Text style={styles.voiceHeroArrowText}>➔</Text>
          </View>
        </TouchableOpacity>

        {/* SIH DEMO MODE BUTTON */}
        <TouchableOpacity
          style={[styles.voiceHeroCard, { backgroundColor: '#3f6653', marginTop: 15 }]}
          onPress={() => navigateTo('sih_demo')}
          activeOpacity={0.88}
        >
          <View style={[styles.voiceHeroMicWrap, { backgroundColor: '#beead1' }]}>
            <Text style={{ fontSize: 24 }}>🚀</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.voiceHeroTitle, { color: '#ffffff' }]}>SIH Demo Mode</Text>
            <Text style={[styles.voiceHeroSub, { color: '#e0e0e0' }]}>
              New Rural-First Guided Interview Experience
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. Popular Sectors: Horizontal Swipeable Carousel with Center-Focus Pop-Out */}
      <View style={{ marginTop: 18 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionHeading}>{t('popular_sectors') || 'POPULAR SECTORS'}</Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => scrollToCard(Math.max(0, activeIndex - 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.arrowButton, { marginLeft: 6 }]}
              onPress={() => scrollToCard(Math.min(popularSectors.length, activeIndex + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.ScrollView
          ref={carouselRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.carouselContainer,
            { paddingHorizontal: CAROUSEL_INSET },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: false,
              listener: (e: any) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const idx = Math.min(
                  popularSectors.length,
                  Math.max(0, Math.round(offsetX / SNAP_INTERVAL))
                );
                setActiveIndex(idx);
              },
            }
          )}
          scrollEventThrottle={16}
        >
          {popularSectors.map((sector, index) => {
            const img = sector.imageKey ? SECTOR_IMAGES[sector.imageKey] : undefined;
            const isFocused = index === activeIndex;
            return (
              <PopularSectorCard
                key={sector.id}
                id={sector.id}
                label={t(sector.titleKey)}
                sub={t(sector.subKey)}
                image={img}
                icon={sector.icon}
                type="sector"
                width={CARD_WIDTH}
                isFocused={isFocused}
                scrollX={scrollX}
                index={index}
                snapInterval={SNAP_INTERVAL}
                onPress={() => handleCardPress(sector)}
              />
            );
          })}

          {/* Action Card: Explore All Sectors */}
          <PopularSectorCard
            id="explore_action"
            label={t('explore_all_sectors') || 'Explore All Sectors'}
            sub={t('explore_sectors_sub') || 'Kirana, Handicraft, Tailoring & More'}
            type="action"
            actionBadgeText={t('view_categories_btn') || 'View 16+ Categories →'}
            width={CARD_WIDTH}
            isFocused={activeIndex === popularSectors.length}
            scrollX={scrollX}
            index={popularSectors.length}
            snapInterval={SNAP_INTERVAL}
            onPress={() => navigateTo('explore_sectors')}
          />
        </Animated.ScrollView>

        {/* Pagination Dots */}
        <View style={styles.paginationDots}>
          {Array.from({ length: popularSectors.length + 1 }).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollToCard(i)}
              style={[styles.dot, i === activeIndex && styles.activeDot]}
            />
          ))}
        </View>
      </View>

      {/* Offline Status */}
      <View style={styles.offlinePill}>
        <View style={styles.offlineDot} />
        <Text style={styles.offlineText}>{t('offline_data_saved') || 'Offline data saved'}</Text>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------
// EXPLORE ALL SECTORS SCREEN (COMPLETE 16+ CATEGORIES)
// ----------------------------------------------------
function ExploreSectorsScreen() {
  const { currentLang, t, setActiveBusiness, navigateTo } = useApp();

  const handleSelectSector = (sector: SectorItem) => {
    setActiveBusiness({
      sector: sector.id,
      title: t(sector.titleKey) || sector.id,
      setupCost: sector.presets.setupCost,
      monthlyFixed: sector.presets.monthlyFixed,
      unitType: sector.presets.unitType,
      pricePerUnit: sector.presets.pricePerUnit,
      costPerUnit: sector.presets.costPerUnit,
      salesPerMonth: sector.presets.salesPerMonth,
      personalCost: sector.presets.personalCost,
      breakdown: sector.presets.breakdown,
    });
    navigateTo('business_details');
  };

  return (
    <ExploreSectorsView
      currentLang={currentLang}
      t={t}
      onSelectSector={handleSelectSector}
      onBack={() => navigateTo('home')}
    />
  );
}

// ----------------------------------------------------
// BUSINESS DETAILS / EDIT DETAILS (WITH NUMERIC VOICE INPUT)
// ----------------------------------------------------
function BusinessDetailsScreen() {
  const { activeBusiness, setActiveBusiness, navigateTo, currentLang, t } = useApp();

  const [setupCost, setSetupCost] = useState((activeBusiness?.setupCost || 95000).toString());
  const [monthlyFixed, setMonthlyFixed] = useState((activeBusiness?.monthlyFixed || 4000).toString());
  const [pricePerUnit, setPricePerUnit] = useState((activeBusiness?.pricePerUnit || 40).toString());
  const [costPerUnit, setCostPerUnit] = useState((activeBusiness?.costPerUnit || 18).toString());
  const [salesPerMonth, setSalesPerMonth] = useState((activeBusiness?.salesPerMonth || 1800).toString());
  const [personalCost, setPersonalCost] = useState((activeBusiness?.personalCost || 8000).toString());
  const [disasterImpact, setDisasterImpact] = useState(0);
  const [isDraggingDisaster, setIsDraggingDisaster] = useState(false);

  // Active numeric voice modal state
  const [voiceTargetField, setVoiceTargetField] = useState<{
    id: string;
    label: string;
    setter: (val: string) => void;
  } | null>(null);

  const numSetup = parseFloat(setupCost) || 0;
  const numFixed = parseFloat(monthlyFixed) || 0;
  const numPrice = parseFloat(pricePerUnit) || 0;
  const numCost = parseFloat(costPerUnit) || 0;
  const numSales = parseFloat(salesPerMonth) || 0;
  const numPersonal = parseFloat(personalCost) || 0;

  const monthlyRevenue = numSales * numPrice;
  const monthlyVariableCost = numSales * numCost;
  const disasterFactor = 1 + disasterImpact;

  const monthlyGrossProfit = (monthlyRevenue * (1 - disasterImpact * 0.5)) - (monthlyVariableCost * disasterFactor);
  const monthlyNetProfit = monthlyGrossProfit - numFixed - numPersonal;

  const profitMargin = monthlyRevenue > 0 ? (monthlyNetProfit / monthlyRevenue) : 0;
  let riskRatio = 0.5;
  if (profitMargin > 0.2) riskRatio = 0.2 + disasterImpact * 0.3;
  else if (profitMargin > 0.05) riskRatio = 0.5 + disasterImpact * 0.4;
  else riskRatio = 0.8 + disasterImpact * 0.2;

  const handleRunRiskTest = () => {
    setActiveBusiness((prev: any) => ({
      ...prev,
      setupCost: numSetup,
      monthlyFixed: numFixed,
      pricePerUnit: numPrice,
      costPerUnit: numCost,
      salesPerMonth: numSales,
      personalCost: numPersonal,
    }));
    navigateTo('my_plan');
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>
          {t('business_financials_title') || 'Business Financials'}
        </Text>
        <Text style={styles.screenHeaderSub}>
          {activeBusiness?.title || 'Farming'} - {t('edit_details_sub') || 'Edit Details'}
        </Text>
      </View>

      {/* Interactive Disaster Slider */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>
          {t('disaster_slider_title') || 'Interactive Disaster Slider'}
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, marginBottom: 10 }}>
          {t('disaster_slider_desc') || 'Simulate drought, pests, or market crashes to see how resilient your business is.'}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: 'bold' }}>{t('impact_severity') || 'Impact Severity:'}</Text>
          <Text style={{ fontWeight: 'bold', color: disasterImpact > 0.5 ? COLORS.error : COLORS.secondary }}>
            {(disasterImpact * 100).toFixed(0)}%
          </Text>
        </View>
        <Slider
          value={disasterImpact}
          onValueChange={setDisasterImpact}
          onSlidingStart={() => setIsDraggingDisaster(true)}
          onSlidingComplete={(v) => {
            setDisasterImpact(v);
            setIsDraggingDisaster(false);
          }}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          minimumTrackTintColor={COLORS.error}
          maximumTrackTintColor={COLORS.outlineVariant}
          thumbTintColor={COLORS.primary}
          style={{ width: '100%', height: 40 }}
        />
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <GoNoGoGauge riskRatio={riskRatio} size={200} animated={!isDraggingDisaster} />
        </View>
      </View>

      {/* Setup Costs with Microphone Voice Input */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>{t('setup_costs_section') || 'Setup Costs (₹)'}</Text>
        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('initial_investment') || 'Initial Investment'}</Text>
            <TouchableOpacity
              style={styles.micInputBadge}
              onPress={() =>
                setVoiceTargetField({
                  id: 'setupCost',
                  label: t('initial_investment') || 'Initial Investment',
                  setter: setSetupCost,
                })
              }
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13 }}>🎙️</Text>
              <Text style={styles.micInputBadgeText}>Speak</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={setupCost}
            onChangeText={setSetupCost}
          />
        </View>
      </View>

      {/* Monthly Economics with Microphone Voice Input on Every Numeric Field */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>
          {t('monthly_economics_section') || 'Monthly Economics'}
        </Text>

        {/* Row 1: Sales/Month & Unit Price */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('sales_per_month') || 'Sales/Mo'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'salesPerMonth',
                    label: t('sales_per_month') || 'Sales / Month',
                    setter: setSalesPerMonth,
                  })
                }
              >
                <Text style={{ fontSize: 11 }}>🎙️</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={salesPerMonth}
              onChangeText={setSalesPerMonth}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('unit_price') || 'Unit Price'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'pricePerUnit',
                    label: t('unit_price') || 'Unit Price',
                    setter: setPricePerUnit,
                  })
                }
              >
                <Text style={{ fontSize: 11 }}>🎙️</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={pricePerUnit}
              onChangeText={setPricePerUnit}
            />
          </View>
        </View>

        {/* Row 2: Unit Cost & Fixed Costs */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('unit_cost') || 'Unit Cost'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'costPerUnit',
                    label: t('unit_cost') || 'Unit Cost',
                    setter: setCostPerUnit,
                  })
                }
              >
                <Text style={{ fontSize: 11 }}>🎙️</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={costPerUnit}
              onChangeText={setCostPerUnit}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('fixed_costs') || 'Fixed Costs'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'monthlyFixed',
                    label: t('fixed_costs') || 'Fixed Costs',
                    setter: setMonthlyFixed,
                  })
                }
              >
                <Text style={{ fontSize: 11 }}>🎙️</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={monthlyFixed}
              onChangeText={setMonthlyFixed}
            />
          </View>
        </View>

        {/* Personal Living Cost */}
        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('personal_cost') || 'Personal Living Cost (₹)'}</Text>
            <TouchableOpacity
              style={styles.micInputBadge}
              onPress={() =>
                setVoiceTargetField({
                  id: 'personalCost',
                  label: t('personal_cost') || 'Personal Living Cost',
                  setter: setPersonalCost,
                })
              }
            >
              <Text style={{ fontSize: 13 }}>🎙️</Text>
              <Text style={styles.micInputBadgeText}>Speak</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={personalCost}
            onChangeText={setPersonalCost}
          />
        </View>

        {/* Live Net Profit preview */}
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 10, paddingTop: 10 }]}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>
            {t('projected_net_profit') || 'Projected Net Profit'}
          </Text>
          <Text style={[styles.breakdownValue, { fontWeight: '800', color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(monthlyNetProfit)}
          </Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.outlineButton, { flex: 1, marginRight: 8 }]}
          onPress={() => navigateTo('home')}
        >
          <Text style={styles.outlineButtonText}>{t('cancel') || 'Cancel'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1, marginLeft: 8 }]}
          onPress={handleRunRiskTest}
        >
          <Text style={styles.primaryButtonText}>{t('save_and_view_plan') || 'Save & View Plan →'}</Text>
        </TouchableOpacity>
      </View>

      {/* Numeric Voice Input Modal */}
      {voiceTargetField && (
        <NumericVoiceModal
          isOpen={!!voiceTargetField}
          fieldLabel={voiceTargetField.label}
          currentLang={currentLang}
          t={t}
          onApplyValue={(num) => {
            voiceTargetField.setter(num.toString());
            setVoiceTargetField(null);
          }}
          onClose={() => setVoiceTargetField(null)}
        />
      )}
    </ScrollView>
  );
}

// ----------------------------------------------------
// MY PLAN SCREEN (FULLY LOCALIZED & MATH ENGINE)
// ----------------------------------------------------
function MyPlanScreen() {
  const { activeBusiness, navigateTo, setActiveBusinessId, t } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setupCost = activeBusiness?.setupCost ?? 95000;
  const monthlyFixed = activeBusiness?.monthlyFixed ?? 4000;
  const pricePerUnit = activeBusiness?.pricePerUnit ?? 40;
  const costPerUnit = activeBusiness?.costPerUnit ?? 18;
  const salesPerMonth = activeBusiness?.salesPerMonth ?? 1800;
  const personalCost = activeBusiness?.personalCost ?? 8000;
  const breakdown = activeBusiness?.breakdown?.length
    ? activeBusiness.breakdown
    : [
        { label: 'Land, equipment & setup', cost: setupCost * 0.6 },
        { label: 'Raw material & inputs', cost: setupCost * 0.3 },
        { label: 'Contingency buffer', cost: setupCost * 0.1 },
      ];

  const monthlyRevenue = salesPerMonth * pricePerUnit;
  const monthlyVariableCost = salesPerMonth * costPerUnit;
  const monthlyGrossProfit = monthlyRevenue - monthlyVariableCost;
  const monthlyNetProfit = monthlyGrossProfit - monthlyFixed - personalCost;
  const totalMonthlyExpenses = monthlyVariableCost + monthlyFixed + personalCost;
  const grossMarginPct = monthlyRevenue > 0 ? (monthlyGrossProfit / monthlyRevenue) * 100 : 0;
  const netMarginPct = monthlyRevenue > 0 ? (monthlyNetProfit / monthlyRevenue) * 100 : 0;
  const contributionPerUnit = pricePerUnit - costPerUnit;
  const breakEvenRevenue =
    contributionPerUnit > 0
      ? ((monthlyFixed + personalCost) / contributionPerUnit) * pricePerUnit
      : 0;
  const safetyMargin = monthlyRevenue - breakEvenRevenue;
  const safetyMarginPct = monthlyRevenue > 0 ? (safetyMargin / monthlyRevenue) * 100 : 0;
  const roiPct = setupCost > 0 ? (monthlyNetProfit * 12) / setupCost * 100 : 0;
  const paybackMonths = monthlyNetProfit > 0 ? Math.ceil(setupCost / monthlyNetProfit) : null;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const handleRunRiskTest = async () => {
    setIsSubmitting(true);
    try {
      const businessData = {
        user_id: 'user_123',
        business_name: activeBusiness.title || 'Organic Vegetable Farming',
        business_category: activeBusiness.sector || 'farming',
        description: JSON.stringify(activeBusiness),
        status: 'DRAFT',
      };
      try {
        const response = await api.business.createBusiness(businessData);
        if (response && response.id) {
          setActiveBusinessId(response.id);
          try {
            await api.business.createAssumption(response.id, buildAssumptionsPayload(activeBusiness, response.id));
          } catch (assumptionErr) {
            console.warn('Failed to persist assumptions:', (assumptionErr as Error).message);
          }
        }
      } catch (e) {
        console.warn('Backend unavailable, continuing with local engine:', (e as Error).message);
        setActiveBusinessId(null);
      }
      navigateTo('risk_test');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>{t('my_business_plan_title') || 'My Business Plan'}</Text>
        <Text style={styles.screenHeaderSub}>{activeBusiness.title || 'Farming'} - {t('phase_1_sub') || 'Phase 1'}</Text>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoLabel}>{t('setup_costs_card') || 'Setup Costs'}</Text>
        <Text style={styles.bentoValuePrimary}>{fmt(setupCost)}</Text>
        <Text style={styles.bentoSub}>{t('initial_inv_sub') || 'Initial investment required'}</Text>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoLabel}>{t('monthly_expenses_card') || 'Monthly Expenses'}</Text>
        <Text style={styles.bentoValuePrimary}>{fmt(totalMonthlyExpenses)}</Text>
        <Text style={styles.bentoSub}>
          {fmt(monthlyVariableCost)} {t('variable_cost_label') || 'variable'} · {fmt(monthlyFixed + personalCost)} {t('fixed_living_label') || 'fixed + living'}
        </Text>
      </View>

      <View style={[styles.bentoCard, { backgroundColor: COLORS.secondaryContainer }]}>
        <Text style={[styles.bentoLabel, { color: COLORS.secondary }]}>
          {t('estimated_profit_card') || 'Estimated Profit'}
        </Text>
        <Text style={[styles.bentoValueSecondary, { color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>
          {fmt(monthlyNetProfit)}
        </Text>
        <Text style={[styles.bentoSub, { color: COLORS.onSecondaryContainer }]}>
          {t('projected_net_sub') || 'Projected net per month'}
        </Text>
      </View>

      {/* Financial Math Engine */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardSectionTitle}>{t('financial_math_section') || 'Financial Math Engine'}</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('monthly_revenue_label') || 'Monthly Revenue'} ({salesPerMonth} × {fmt(pricePerUnit)})</Text>
          <Text style={styles.breakdownValue}>{fmt(monthlyRevenue)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('variable_cost_label') || 'Variable Cost'} ({salesPerMonth} × {fmt(costPerUnit)})</Text>
          <Text style={styles.breakdownValue}>−{fmt(monthlyVariableCost)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('gross_profit_label') || 'Gross Profit'} ({grossMarginPct.toFixed(1)}%)</Text>
          <Text style={[styles.breakdownValue, { color: COLORS.secondary }]}>{fmt(monthlyGrossProfit)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('fixed_living_label') || 'Fixed + Living Costs'}</Text>
          <Text style={styles.breakdownValue}>−{fmt(monthlyFixed + personalCost)}</Text>
        </View>
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 4, paddingTop: 8 }]}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>{t('net_monthly_profit_label') || 'Net Monthly Profit'} ({netMarginPct.toFixed(0)}%)</Text>
          <Text style={[styles.breakdownValue, { fontWeight: '800', color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(monthlyNetProfit)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('breakeven_rev_label') || 'Break-even Revenue / Month'}</Text>
          <Text style={styles.breakdownValue}>{fmt(breakEvenRevenue)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('safety_margin_label') || 'Safety Margin'} ({safetyMarginPct.toFixed(0)}%)</Text>
          <Text style={[styles.breakdownValue, { color: safetyMargin >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(safetyMargin)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('projected_roi_label') || 'Projected ROI'}</Text>
          <Text style={styles.breakdownValue}>{roiPct.toFixed(1)}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('payback_period_label') || 'Payback Period'}</Text>
          <Text style={styles.breakdownValue}>{paybackMonths ? `${paybackMonths} ${t('months') || 'months'}` : 'N/A'}</Text>
        </View>
      </View>

      {/* Plan Breakdown */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardSectionTitle}>{t('plan_breakdown_section') || 'Plan Cost Breakdown'}</Text>
        {breakdown.map((item: any, i: number) => (
          <View key={i} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{item.label}</Text>
            <Text style={styles.breakdownValue}>{fmt(item.cost || 0)}</Text>
          </View>
        ))}

        <View style={[styles.row, { marginTop: 16 }]}>
          <TouchableOpacity
            style={[styles.outlineButton, { flex: 1, marginRight: 8 }]}
            onPress={() => navigateTo('business_details')}
          >
            <Text style={styles.outlineButtonText}>{t('edit_details_btn') || 'Edit Details'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, marginLeft: 8, marginTop: 0 }]}
            onPress={handleRunRiskTest}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? t('waiting_btn') || 'Wait...' : t('view_risk_btn') || 'View Risk →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------
// RISK TEST SCREEN (FULLY LOCALIZED WITH TTS VERDICT)
// ----------------------------------------------------
function RiskTestScreen() {
  const { activeBusinessId, setActiveBusinessId, activeBusiness, aiReport, setAiReport, currentLang, t } = useApp();
  const [loading, setLoading] = useState(!aiReport);
  const [dashboardData, setDashboardData] = useState(null);

  const handleHearSummary = () => {
    const d = (dashboardData || dashboardView)?.recommendation;
    if (!d) return;
    const summary = `${d.decision || ''}. ${d.rationale || 'Analysis complete.'} ` +
      `Confidence ${Math.round((aiReport?.confidence || 0.85) * 100)} percent.`;
    speak(summary, currentLang);
  };

  const isGeneratingRef = useRef(false);

  useEffect(() => {
    if (aiReport && aiReport.business_id === activeBusinessId) return;
    if (isGeneratingRef.current) return;
    generateReport();
  }, [activeBusinessId]);

  const generateReport = async () => {
    isGeneratingRef.current = true;
    setLoading(true);
    try {
      let bizId = activeBusinessId;
      if (!bizId) {
        try {
          const businessData = {
            user_id: 'user_123',
            business_name: activeBusiness?.title || 'Organic Vegetable Farming',
            business_category: activeBusiness?.sector || 'farming',
            description: JSON.stringify(activeBusiness || {}),
            status: 'DRAFT',
          };
          const created = await api.business.createBusiness(businessData);
          if (created?.id) {
            bizId = created.id;
            try {
              await api.business.createAssumption(created.id, buildAssumptionsPayload(activeBusiness || {}, created.id));
            } catch (e) {
              // ignore
            }
          }
        } catch (createErr) {
          console.warn('Auto-create failed:', (createErr as Error).message);
        }
      }

      let report = null;
      if (bizId) {
        try {
          report = await api.aiReports.generateReport(bizId);
          setAiReport(report);
          if (typeof setActiveBusinessId === 'function') {
            setActiveBusinessId(bizId);
          }
        } catch (apiErr) {
          console.warn('API error, falling back to local analysis model:', (apiErr as Error).message);
        }
      }

      if (!report) {
        report = {
          decision: 'GO',
          rationale: 'Validated rural model with strong local demand and robust cash flow safety margin.',
          confidence: 0.88,
          market_analysis: {
            demand_level: 'HIGH',
            swot_strengths: ['High gross margin (55%)', 'Consistent local daily demand', 'Low initial fixed overhead'],
            swot_weaknesses: ['Seasonal price variations', 'Perishable inventory without cold storage'],
            swot_opportunities: ['Direct supply to weekly village haats and local retail stores', 'Government scheme subsidies'],
            swot_threats: ['Climatic fluctuation', 'Local competitor entry'],
          },
          risk_assessment: {
            overall_risk: 0.28,
            market_risk: 0.25,
            operational_risk: 0.3,
            top_risks: ['Input cost inflation', 'Seasonal demand drop'],
            mitigation_strategies: ['Pre-book supplies at wholesale rate', 'Diversify product offerings'],
          },
          next_steps: ['Validate local supplier credit terms', 'Finalize sales points and initial stock', 'Begin Phase 1 pilot setup'],
        };
      }

      const dashboardFormat = transformReportToDashboard(report, activeBusiness);
      setDashboardData(dashboardFormat);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      isGeneratingRef.current = false;
    }
  };

  const transformReportToDashboard = (report: any, business: any): any => {
    const setupCost = business?.setupCost || 0;
    const monthlyFixed = business?.monthlyFixed || 0;
    const pricePerUnit = business?.pricePerUnit || 0;
    const costPerUnit = business?.costPerUnit || 0;
    const salesPerMonth = business?.salesPerMonth || 0;
    const personalCost = business?.personalCost || 0;

    // Use Canonical Engine
    const inputs = {
      requested_loan_amount: setupCost * 0.5,
      maximum_scheme_loan_amount: 99999999,
      annual_interest_rate_percent: 12,
      repayment_tenure_months: 24,
      moratorium_months: 0,
      monthly_units_sold: salesPerMonth,
      selling_price_per_unit: pricePerUnit,
      variable_cost_per_unit: costPerUnit,
      monthly_fixed_cost: monthlyFixed,
      monthly_household_nonbusiness_income: 0,
      monthly_household_essential_expenses: personalCost,
      existing_monthly_household_debt_payments: 0
    };
    
    // @ts-ignore
    const { calculateFinancialAssessment } = require('../../engine/financeCalculator');
    const result = calculateFinancialAssessment(inputs, { minimum_business_dscr: 1.2, maximum_household_debt_ratio: 0.5 });

    const monthlyRevenue = result.monthly_revenue || 0;
    const monthlyVariableCost = result.monthly_variable_cost || 0;
    const monthlyNetProfit = result.business_cash_available_for_debt_service || 0;
    const breakEvenRevenue = result.break_even_units ? result.break_even_units * pricePerUnit : 0;
    const safetyMargin = monthlyRevenue - breakEvenRevenue;
    const safetyMarginPct = monthlyRevenue > 0 ? (safetyMargin / monthlyRevenue) * 100 : 45;
    const loanAmount = setupCost * 0.5;
    const loanEMI = result.emi || 0;

    const decisionMap: any = {
      GO: 'GO',
      MODIFY: 'CAUTION',
      DO_NOT_INVEST_YET: 'NO-GO',
    };

    const risks = [
      {
        risk: 'Market Demand Fluctuation',
        category: 'Market',
        probability: 0.35,
        impact: 'Medium',
        severity: 'Medium',
        financialExposure: Math.floor(monthlyRevenue * 0.12),
        mitigation: 'Establish weekly forward contracts with local vendors',
      },
      {
        risk: 'Raw Material Cost Surge',
        category: 'Operational',
        probability: 0.3,
        impact: 'Medium',
        severity: 'Medium',
        financialExposure: Math.floor(monthlyRevenue * 0.1),
        mitigation: 'Bulk procurement and buffer inventory stocking',
      },
      {
        risk: 'Climate / Weather Disruption',
        category: 'Environmental',
        probability: 0.25,
        impact: 'Low',
        severity: 'Low',
        financialExposure: Math.floor(monthlyRevenue * 0.08),
        mitigation: 'Implement drip irrigation and sheltered sheds',
      },
    ];

    const swot = {
      strengths: (report.market_analysis?.swot_strengths || []).map((s: string) => ({
        finding: s,
        whyItMatters: 'Provides sustainable competitive moat and immediate positive unit economics',
        impact: 'High',
      })),
      weaknesses: (report.market_analysis?.swot_weaknesses || []).map((w: string) => ({
        finding: w,
        whyItMatters: 'Requires careful working capital management',
        impact: 'Medium',
      })),
      opportunities: (report.market_analysis?.swot_opportunities || []).map((o: string) => ({
        finding: o,
        whyItMatters: 'Opens avenues for scaling revenue beyond village baseline',
        impact: 'High',
      })),
      threats: (report.market_analysis?.swot_threats || []).map((t: string) => ({
        finding: t,
        whyItMatters: 'External macroeconomic risks to monitor continuously',
        impact: 'Low',
      })),
    };

    const scenarios = [
      {
        name: 'Baseline',
        revenueChange: 0,
        costChange: 0,
        monthlyRevenue: monthlyRevenue,
        monthlyExpenses: monthlyVariableCost + monthlyFixed,
        loanEMI: loanEMI,
        netCashFlow: monthlyNetProfit,
      },
      {
        name: 'Mild Stress (-10% rev, +10% cost)',
        revenueChange: -10,
        costChange: 10,
        monthlyRevenue: monthlyRevenue * 0.9,
        monthlyExpenses: (monthlyVariableCost + monthlyFixed) * 1.1,
        loanEMI: loanEMI,
        netCashFlow: monthlyRevenue * 0.9 - (monthlyVariableCost + monthlyFixed) * 1.1 - loanEMI,
      },
      {
        name: 'Moderate Stress (-20% rev, +20% cost)',
        revenueChange: -20,
        costChange: 20,
        monthlyRevenue: monthlyRevenue * 0.8,
        monthlyExpenses: (monthlyVariableCost + monthlyFixed) * 1.2,
        loanEMI: loanEMI,
        netCashFlow: monthlyRevenue * 0.8 - (monthlyVariableCost + monthlyFixed) * 1.2 - loanEMI,
      },
    ];

    return {
      overallRiskScore: 0.28,
      businessViabilityScore: 0.88,
      financialResilience: Math.min(0.9, Math.max(0.1, monthlyNetProfit / monthlyRevenue || 0.25)),
      marketRisk: 0.25,
      operationalRisk: 0.3,
      swot,
      risks,
      financials: {
        monthlyRevenue,
        monthlyExpenses: monthlyVariableCost + monthlyFixed,
        loanEMI,
        netCashFlow: monthlyNetProfit,
        breakEvenRevenue,
        safetyMargin,
      },
      baseInputs: {
        pricePerUnit,
        costPerUnit,
        salesPerMonth,
        monthlyFixed,
        personalCost,
        setupCost,
        loanAmount,
        interestRatePercent: 12,
        loanTenureMonths: 24,
      },
      scenarios,
      recommendation: {
        decision: 'REVIEW',
        rationale: report.summary || 'Analysis complete',
        supportingPoints: [
          report.deterministic_findings_explained || 'Findings explained.',
          ...(report.caveats || []),
        ],
        actionItems: report.suggested_next_steps || ['Finalize vendor list', 'Review working capital buffer', 'Initiate Phase 1 setup'],
      },
    };
  };

  const dashboardView =
    dashboardData ||
    (aiReport && aiReport.business_id === activeBusinessId
      ? transformReportToDashboard(aiReport, activeBusiness)
      : null);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>{t('reality_check_title') || 'Reality Check & Risk'}</Text>
        <Text style={styles.screenHeaderSub}>{t('ai_analysis_sub') || 'Multi-Agent AI Analysis'}</Text>
      </View>

      {!loading && dashboardView && (
        <TouchableOpacity
          style={[styles.demoButton, { marginHorizontal: 20, marginBottom: 12 }]}
          onPress={handleHearSummary}
          activeOpacity={0.8}
        >
          <Text style={[styles.demoButtonText, { color: COLORS.secondary }]}>
            {t('hear_ai_verdict') || '🔊 Hear the AI Verdict'}
          </Text>
        </TouchableOpacity>
      )}

      {loading && !dashboardView ? (
        <View style={[styles.card, { padding: 30, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🤖</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' }}>
            {t('ai_analyzing_title') || 'Aarthika AI is analyzing your business...'}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 10, textAlign: 'center' }}>
            {t('ai_analyzing_sub') || '(Context Retrieval → Market Analyst → Risk Actuary → Final Decision)'}
          </Text>
        </View>
      ) : (
        <RiskAnalysisDashboard riskData={dashboardView} />
      )}
    </ScrollView>
  );
}

// ----------------------------------------------------
// PROFILE SCREEN (FULLY LOCALIZED)
// ----------------------------------------------------
function ProfileScreen() {
  const { user, handleLogout, setIsLangModalOpen, currentLang, t } = useApp();

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी (Hindi)',
    bn: 'বাংলা (Bengali)',
    ml: 'മലയാളം',
    te: 'తెలుగు',
    pa: 'ਪੰਜਾਬੀ',
    kn: 'ಕನ್ನಡ',
    ur: 'اردو',
    bho: 'भोजपुरी',
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* User Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatarCircle}>
          <Text style={{ fontSize: 36 }}>👤</Text>
        </View>
        <Text style={styles.profileName}>{user.fullName || 'Ramesh Kumar'}</Text>
        <View style={styles.profileLocationBadge}>
          <Text style={styles.profileLocationText}>
            📍 {user.village ? `${user.village}, ` : ''}{user.district || 'Raigarh'}, {user.state || 'Chhattisgarh'}
          </Text>
        </View>
      </View>

      {/* Profile Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>{t('profile_info_section') || 'Profile Information'}</Text>
        
        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('mobile_number') || 'Mobile Number'}</Text>
          <Text style={styles.profileInfoValue}>{user.mobile || '9876543210'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('age_dob') || 'Age'}</Text>
          <Text style={styles.profileInfoValue}>{user.age ? `${user.age} years` : '28 years'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('current_occupation') || 'Occupation'}</Text>
          <Text style={styles.profileInfoValue}>{user.occupation || 'Farmer'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('interested_business') || 'Interested Business'}</Text>
          <Text style={styles.profileInfoValue}>{user.interestedSector || 'Farming'}</Text>
        </View>

        <View style={[styles.profileInfoItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.profileInfoLabel}>{t('village_town') || 'Village / Town'}</Text>
          <Text style={styles.profileInfoValue}>
            {user.village || 'Dharamjaigarh'} ({user.district || 'Raigarh'})
          </Text>
        </View>
      </View>

      {/* App Settings Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>{t('app_settings_title') || 'App Preferences'}</Text>
        
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setIsLangModalOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.settingsRowLeft}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🌐</Text>
            <View>
              <Text style={styles.settingsRowTitle}>{t('app_language') || 'App Language'}</Text>
              <Text style={styles.settingsRowSub}>{langNames[currentLang] || 'English'}</Text>
            </View>
          </View>
          <Text style={styles.settingsArrow}>➔</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>{t('log_out') || 'Log Out'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ----------------------------------------------------
// LANGUAGE SELECTION MODAL (9 LANGUAGES INCLUDING BENGALI)
// ----------------------------------------------------
function LanguageModal({ isOpen, onClose, currentLang, onSelect, t }: any) {
  const langs = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'bn', label: 'বাংলা (Bengali)' },
    { code: 'ml', label: 'മലയാളം (Malayalam)' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ur', label: 'اردو (Urdu)' },
    { code: 'bho', label: 'भोजपुरी (Bhojpuri)' },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
          <View style={styles.modalGrabHandle} />
          <Text style={styles.modalTitle}>{t('select_language_title') || 'Select Language'}</Text>
          {langs.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langOption, currentLang === l.code && styles.activeLangOption]}
              onPress={() => onSelect(l.code)}
            >
              <Text style={styles.langOptionText}>{l.label}</Text>
              {currentLang === l.code && <Text style={{ color: COLORS.secondary, fontWeight: 'bold' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ----------------------------------------------------
// VOICE MODAL (SPEAK TO AARTHIKA - REAL SPEECH-TO-TEXT)
// ----------------------------------------------------
function VoiceModal({ isOpen, onClose, t, currentLang, onTranscript }: any) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const spokenRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for mic listening state
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Start listening and speak TTS prompt on open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setVoiceError(null);
      if (!spokenRef.current) {
        spokenRef.current = true;
        const prompt = t('home_question') || 'What business do you want to start or grow?';
        speak(prompt, currentLang);
      }
      startListening();
    } else {
      spokenRef.current = false;
      stopSpeaking();
      sttService.stopListening();
      setIsListening(false);
    }
    return () => {
      sttService.stopListening();
    };
  }, [isOpen, currentLang]);

  const startListening = () => {
    setVoiceError(null);
    setIsListening(true);
    sttService.startListening({
      lang: currentLang,
      continuous: false,
      interimResults: true,
      onStart: () => {
        setIsListening(true);
      },
      onResult: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          setIsListening(false);
        }
      },
      onError: (err) => {
        setIsListening(false);
        setVoiceError(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const handleSubmit = () => {
    const text = transcript.trim();
    if (!text) return;
    stopSpeaking();
    sttService.stopListening();
    onTranscript(text);
    setTranscript('');
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.voiceModalCard}>
          {/* Pulsing Mic Circle */}
          <Animated.View
            style={[
              styles.voiceMicCircle,
              isListening && styles.voiceMicCircleActive,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <TouchableOpacity
              onPress={isListening ? () => sttService.stopListening() : startListening}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 36 }}>🎙️</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.voiceTitle}>
            {isListening
              ? t('voice_listening') || 'Listening to you...'
              : t('voice_tap_to_speak') || 'Tap mic to speak'}
          </Text>

          <Text style={styles.voicePrompt}>
            "{t('home_question') || 'What business do you want to start or grow?'}"
          </Text>

          {voiceError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{voiceError}</Text>
            </View>
          )}

          <TextInput
            style={[styles.textInput, { alignSelf: 'stretch', marginTop: 12 }]}
            placeholder={t('speak_idea_prompt') || 'Type or dictate your business idea...'}
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={transcript}
            onChangeText={setTranscript}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          <TouchableOpacity
            style={[styles.primaryButton, { alignSelf: 'stretch', marginTop: 12 }]}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryButtonText}>
              {t('create_biz_from_voice_btn') || 'Use Spoken Idea →'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.stopVoiceButton, { marginRight: 8, backgroundColor: COLORS.secondary }]}
              onPress={() => speak(t('home_question') || 'What business do you want to start or grow?', currentLang)}
            >
              <Text style={styles.stopVoiceText}>{t('hear_prompt_btn') || '🔊 Hear Prompt'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopVoiceButton} onPress={onClose}>
              <Text style={styles.stopVoiceText}>{t('stop_voice_btn') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------
// MOBILE STYLESHEET (AUTHENTIC MOBILE APPLICATION DESIGN)
// ----------------------------------------------------
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#ecebe0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 58,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 194, 181, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 42,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  langIcon: { fontSize: 13, marginRight: 4 },
  langButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dropdownArrow: { fontSize: 8, color: COLORS.primary, marginLeft: 4 },

  screenContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 90 },

  authHeader: { alignItems: 'center', marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginBottom: 4, textAlign: 'center' },
  authSubtitle: { fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 10 },

  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.3)',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.onSurface,
    marginBottom: 10,
    minHeight: 46,
  },
  inputContainer: {
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.onSurface,
    minHeight: 46,
  },

  micInputBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2f4ea',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  micInputBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2d6a4f',
    marginLeft: 3,
  },
  micSmallBtn: {
    padding: 4,
    backgroundColor: '#e2f4ea',
    borderRadius: 10,
    marginTop: 6,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  primaryButton: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.onPrimaryContainer,
  },

  demoButton: {
    backgroundColor: COLORS.secondaryContainer,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  outlineButton: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  outlineButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  switchAuthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchAuthText: { fontSize: 13, color: COLORS.onSurfaceVariant },
  switchAuthLink: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },

  /* Home Screen Styles */
  heroGreetingCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.35)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
    alignItems: 'center',
  },
  heroTaglineBadge: {
    backgroundColor: COLORS.deepForest,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  heroTaglineText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  heroGreetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onSurface,
    marginBottom: 4,
  },
  heroGreetingSub: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  searchVoiceSection: {
    marginBottom: 14,
  },
  unifiedSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(216, 194, 181, 0.6)',
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBarIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  unifiedSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.onSurface,
    paddingVertical: 0,
  },
  searchGoPill: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  searchGoPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onPrimaryContainer,
  },
  searchMicPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2f4ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.deepForest,
    borderRadius: 18,
    padding: 14,
    shadowColor: COLORS.deepForest,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceHeroMicWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  voiceHeroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
    lineHeight: 15,
  },
  voiceHeroArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  voiceHeroArrowText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },

  sectionHeading: { fontSize: 12, fontWeight: '800', color: COLORS.onSurfaceVariant, letterSpacing: 0.5 },
  arrowButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginTop: -2,
  },

  carouselContainer: {
    paddingVertical: 4,
    gap: 12,
  },

  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(216, 194, 181, 0.7)',
  },
  activeDot: {
    width: 18,
    backgroundColor: COLORS.secondary,
  },

  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 12,
  },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.secondary, marginRight: 6 },
  offlineText: { fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant },

  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  screenHeaderSub: { fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: 2 },

  bentoCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.3)',
    marginBottom: 10,
  },
  bentoLabel: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  bentoValuePrimary: { fontSize: 24, fontWeight: '700', color: COLORS.primary, marginVertical: 3 },
  bentoValueSecondary: { fontSize: 24, fontWeight: '700', color: COLORS.secondary, marginVertical: 3 },
  bentoSub: { fontSize: 11, color: COLORS.onSurfaceVariant },

  cardSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  breakdownLabel: { fontSize: 13, color: COLORS.onSurface },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },

  /* Profile Screen Styles */
  profileHeader: { alignItems: 'center', marginVertical: 14 },
  profileAvatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  profileLocationBadge: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  profileLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  profileInfoItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  profileInfoLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  profileInfoValue: { fontSize: 14, color: COLORS.onSurface, fontWeight: '700', marginTop: 1 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  settingsRowSub: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 1,
  },
  settingsArrow: {
    fontSize: 14,
    color: COLORS.outline,
    fontWeight: '700',
  },
  logoutButton: { marginTop: 16, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: 12, paddingVertical: 12, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  logoutButtonText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216, 194, 181, 0.25)',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 14, position: 'relative' },
  activeTabItem: {},
  tabIconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeTabIconWrap: { width: 52, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondaryContainer, borderRadius: 14 },
  tabIcon: { fontSize: 16 },
  activeTabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: COLORS.onSurfaceVariant, marginTop: 2 },
  activeTabLabel: { color: COLORS.deepForest, fontWeight: '800' },
  activeTabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.deepForest, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '65%' },
  modalGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.outlineVariant,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface, marginBottom: 12 },
  langOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  activeLangOption: { backgroundColor: COLORS.secondaryContainer, borderRadius: 10, paddingHorizontal: 10 },
  langOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.onSurface },

  voiceModalCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 24, padding: 20, margin: 20, alignItems: 'center' },
  voiceMicCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f5f4e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMicCircleActive: {
    backgroundColor: 'rgba(244, 162, 97, 0.35)',
  },
  voiceTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginTop: 10 },
  voicePrompt: { fontSize: 13, color: COLORS.onSurfaceVariant, marginVertical: 10, textAlign: 'center', fontStyle: 'italic', maxWidth: 300 },
  stopVoiceButton: { backgroundColor: COLORS.error, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 8, marginTop: 10 },
  stopVoiceText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#ffdad6', borderRadius: 8, padding: 8, marginTop: 6, width: '100%' },
  errorText: { fontSize: 12, color: '#ba1a1a', textAlign: 'center' },
});
