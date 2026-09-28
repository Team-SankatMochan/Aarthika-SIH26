/**
 * AARTHIKA - Mobile Application (React Native / Expo)
 * "Clarity Before Credit"
 */

import React, { useState, useEffect, createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { api, isBackendConfigured } from '../services/api';
import { speak, stopSpeaking } from '../services/tts';
import { generateAnalyticsSnapshot, snapshotToDashboardData, editableValue, createBlankCustomBusiness, type BusinessPlanInputs, type AnalyticsSnapshot } from '../services/businessAnalytics';
import { AARTHIKA_CALCULATION_POLICY, getSIHSchemeTerms } from '../engine/SIHSchemeRules';
import { sttService } from '../services/stt';
import { parseSpokenNumber } from '../services/numberParser';
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
import { RiskAnalysisDashboard } from '../components/RiskAnalysisDashboard';


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

// Shared helper: map in-memory activeBusiness plan to backend canonical schema (Section H).
// Uses the backend's canonical fields — does NOT fabricate arbitrary splits.
export function buildAssumptionsPayload(biz: any, businessId: string): Record<string, unknown> {
  let assumptionSource = 'ENTREPRENEUR';
  if (biz?.presetSource === 'USER_CONFIRMED_ESTIMATE') {
    assumptionSource = 'USER_CONFIRMED_ESTIMATE';
  } else if (biz?.presetSource === 'SUGGESTED_ESTIMATE' || biz?.presetSource === 'PRESET_UNCONFIRMED' || biz?.presetSource === 'PRESET') {
    assumptionSource = 'PRESET_UNCONFIRMED';
  } else if (biz?.presetSource === 'ENTREPRENEUR' || biz?.presetSource === 'USER_PROVIDED') {
    assumptionSource = 'ENTREPRENEUR';
  }

  return {
    business_id: businessId,
    monthly_units_sold: biz?.salesPerMonth ?? null,
    unit_of_measure: biz?.unitType || 'unit',
    selling_price_per_unit: biz?.pricePerUnit ?? null,
    variable_cost_per_unit: biz?.costPerUnit ?? null,
    monthly_fixed_cost: biz?.monthlyFixed ?? null,
    available_margin_capital: biz?.availableMarginCapital ?? null,
    project_cost: biz?.setupCost ?? null,
    requested_loan_amount: biz?.requestedLoanAmount ?? null,
    monthly_household_nonbusiness_income: biz?.householdIncome ?? null,
    monthly_household_essential_expenses: biz?.householdEssentialExpenses ?? biz?.personalCost ?? null,
    existing_monthly_household_debt_payments: biz?.existingEMI ?? null,
    assumption_source: assumptionSource,
  };
}

/**
 * Dynamically initialize a live business plan from user voice/text input.
 * Maps recognized sectors to standard presets with presetSource: 'USER_PROVIDED',
 * eliminating all demo tags and providing immediate live calculations.
 */
export function createDynamicBusinessPlan(title: string): any {
  const cleanTitle = (title || '').trim();
  const lower = cleanTitle.toLowerCase();

  // Sector keyword matching across Hindi & English
  let matchedSector: SectorItem | undefined;
  if (/dairy|दूध|डेयरी|गाय|भैंस|cow|buffalo|cattle|milk/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'dairy');
  } else if (/farm|खेती|किसान|कृषि|crop|vegetable|sabji|सबजी|फसल|धान|गेहूं/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'farming');
  } else if (/poultry|मुर्गी|murgi|chicken|egg|अंडा/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'poultry');
  } else if (/goat|बकरी|bakri|sheep|भेड़/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'goat');
  } else if (/kirana|किराना|grocery|store|dukan|दुकान|general store|ration/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'kirana');
  } else if (/tailor|दर्जी|सिलाई|sewing|cloth|कपड़े|boutique/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'tailoring');
  } else if (/beauty|parlour|salon|ब्यूटी|पार्लर/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'beauty');
  } else if (/garment|retail|कपड़ा/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'retail');
  } else if (/repair|रिपेयर|मोबाइल|mobile/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'mobile_repair');
  } else if (/carpenter|furniture|बढ़ई|लकड़ी/i.test(lower)) {
    matchedSector = SECTOR_CATALOG.find((s) => s.id === 'carpentry');
  }

  if (!matchedSector) {
    matchedSector = SECTOR_CATALOG.find((s) => lower.includes(s.id));
  }

  const presets = matchedSector?.presets || {
    setupCost: 95000,
    monthlyFixed: 4500,
    unitType: 'Unit',
    pricePerUnit: 400,
    costPerUnit: 200,
    salesPerMonth: 80,
    personalCost: 8000,
    breakdown: [
      { label: 'Equipment & Workspace Setup', cost: 60000 },
      { label: 'Initial Inventory & Material Buffer', cost: 35000 },
    ],
  };

  const setupCost = presets.setupCost;
  const margin = Math.round(setupCost * 0.15);
  const loan = Math.max(0, setupCost - margin);

  const plan = {
    sector: matchedSector ? matchedSector.id : 'custom',
    title: cleanTitle || (matchedSector ? matchedSector.id : 'My Business Plan'),
    setupCost: presets.setupCost,
    monthlyFixed: presets.monthlyFixed,
    unitType: presets.unitType,
    pricePerUnit: presets.pricePerUnit,
    costPerUnit: presets.costPerUnit,
    salesPerMonth: presets.salesPerMonth,
    householdEssentialExpenses: presets.personalCost,
    personalCost: presets.personalCost,
    availableMarginCapital: margin,
    requestedLoanAmount: loan,
    householdIncome: 6000,
    existingEMI: 0,
    presetSource: 'SUGGESTED_ESTIMATE',
    breakdown: presets.breakdown || [],
  };

  try {
    AsyncStorage.setItem('@business_plan', JSON.stringify(plan));
    
    // Also populate globalInputStore as unconfirmed
    const t = Date.now();
    const source = 'SUGGESTED_ESTIMATE';
    
    const storeObj = require('../engine/CanonicalInputStore').globalInputStore;
    storeObj.set({ field: 'project_cost', value: plan.setupCost, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'monthly_fixed_cost', value: plan.monthlyFixed, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'unit_of_measure', value: plan.unitType, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'selling_price_per_unit', value: plan.pricePerUnit, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'variable_cost_per_unit', value: plan.costPerUnit, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'monthly_units_sold', value: plan.salesPerMonth, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'monthly_household_essential_expenses', value: plan.householdEssentialExpenses, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'available_margin_capital', value: plan.availableMarginCapital, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'requested_loan_amount', value: plan.requestedLoanAmount, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'monthly_household_nonbusiness_income', value: plan.householdIncome, source, confirmed: false, timestamp: t });
    storeObj.set({ field: 'existing_monthly_household_debt_payments', value: plan.existingEMI, source, confirmed: false, timestamp: t });
  } catch (_e) {
    // ignore
  }

  return plan;
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

const AppContext = createContext<any>({
  currentLang: 'en',
  setCurrentLang: (lang: string) => {},
  currentScreen: 'touchless_auth',
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
    isGuest: false,
    backendUserId: null as string | null,
  },
  setUser: () => {},
  activeBusiness: createBlankCustomBusiness(''),
  setActiveBusiness: () => {},
  activeBusinessId: null,
  setActiveBusinessId: () => {},
  aiReport: null,
  setAiReport: () => {},
  isAuthenticated: false,
  saveTouchlessProfile: async (_data: any) => {},
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
  // eslint-disable-next-line react-hooks/immutability
  _tGlobal.currentLang = currentLang;
  const [currentScreen, setCurrentScreen] = useState('touchless_auth');
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
    isGuest: false,
    backendUserId: null as string | null,
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
          if (parsed && (parsed.fullName || parsed.firstName || parsed.occupation || parsed.isGuest)) {
            setUser(parsed);
            setIsAuthenticated(true);
            setCurrentScreen('home');
            return;
          }
        }
        setCurrentScreen('touchless_auth');
      } catch (e) {
        console.warn('Could not load user from storage', e);
        setCurrentScreen('touchless_auth');
      }
    })();
  }, []);

  const [activeBusiness, setActiveBusiness] = useState<any>(() => createBlankCustomBusiness(''));
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
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

  // Touchless profile saving — no fake guest defaults (Section J)
  const saveTouchlessProfile = async (profileData: { name?: string; place?: string; occupation?: string; age?: string; isGuest?: boolean }) => {
    const isGuest = !!profileData.isGuest;
    const rawName = (profileData.name || '').trim();
    const nameParts = rawName ? rawName.split(' ') : [];
    const updatedUser = {
      ...user,
      isGuest,
      fullName: rawName,
      firstName: nameParts[0] || (isGuest ? '' : rawName),
      lastName: nameParts.slice(1).join(' ') || '',
      village: (profileData.place || '').trim(),
      district: (profileData.place || '').trim(),
      occupation: (profileData.occupation || '').trim(),
      age: profileData.age ? profileData.age.toString().trim() : '',
      interestedSector: (profileData.occupation || '').trim(),
      backendUserId: null as string | null,
    };

    if (isBackendConfigured && !isGuest && updatedUser.fullName) {
      try {
        const backendRes = await api.users.createUser({
          name: updatedUser.fullName,
          available_capital: 0,
          experience: updatedUser.occupation || undefined,
          skills: updatedUser.occupation ? [updatedUser.occupation] : [],
          family_workforce: 1,
          preferences: {
            place: updatedUser.village || undefined,
            occupation: updatedUser.occupation || undefined,
            age: updatedUser.age || undefined,
          },
        });
        if (backendRes?.id) {
          updatedUser.backendUserId = backendRes.id;
        }
      } catch (err) {
        console.warn('Touchless user backend sync failed:', err);
      }
    }

    setUser(updatedUser);
    setIsAuthenticated(true);
    setCurrentScreen('home');
    try {
      await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
      await AsyncStorage.setItem('@touchless_profile', JSON.stringify(profileData));
    } catch (e) {
      console.warn('Failed to persist touchless profile', e);
    }
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
    stopSpeaking();
    setIsAuthenticated(false);
    setCurrentScreen('touchless_auth');
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
      isGuest: false,
      backendUserId: null,
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
        saveTouchlessProfile,
        handleSignup,
        handleLogin,
        handleLogout,
        t,
        setIsVoiceActive,
        setIsLangModalOpen,
      }}
    >
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

          {/* Mobile Header with Official Logo & Language Selector */}
          <MobileHeader />

          {/* Dynamic Screen Renderer */}
          <View style={styles.screenContainer}>
            {(currentScreen === 'touchless_auth' || currentScreen === 'signup' || currentScreen === 'login') && (
              <TouchlessAuthScreen />
            )}
            {currentScreen === 'home' && <HomeScreen />}
            {currentScreen === 'my_plan' && <MyPlanScreen />}
            {currentScreen === 'risk_test' && <RiskTestScreen />}
            {currentScreen === 'profile' && <ProfileScreen />}
            {currentScreen === 'business_details' && <BusinessDetailsScreen />}
            {currentScreen === 'explore_sectors' && <ExploreSectorsScreen />}

          </View>

          {/* Mobile Bottom Tab Navigation */}
          {isAuthenticated && currentScreen !== 'touchless_auth' && currentScreen !== 'signup' && currentScreen !== 'login' && (
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.surfaceContainerLowest }}>
              <View style={styles.tabBar}>
                {[
                  { key: 'home', icon: '🏠', label: t('tab_home') || 'Home' },
                  { key: 'my_plan', icon: '📋', label: t('tab_plan') || 'Plan' },
                  { key: 'risk_test', icon: '📊', label: t('tab_risk') || 'Risk' },
                  { key: 'profile', icon: '👤', label: t('tab_profile') || 'Profile' },
                ].map((tab) => {
                  const isActive = currentScreen === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tabItem, isActive && styles.activeTabItem]}
                      onPress={() => navigateTo(tab.key)}
                      activeOpacity={0.7}
                    >
                      <View style={isActive ? styles.activeTabIconWrap : styles.tabIconWrap}>
                        <Text style={isActive ? styles.activeTabIcon : styles.tabIcon}>{tab.icon}</Text>
                      </View>
                      <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
                      {isActive && <View style={styles.activeTabDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
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
              const plan = createDynamicBusinessPlan(text);
              setActiveBusiness(plan);
              setIsVoiceActive(false);
              navigateTo('my_plan');
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
        onPress={() => (isAuthenticated ? navigateTo('home') : navigateTo('touchless_auth'))}
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
  const [scrollX] = useState(() => new Animated.Value(0));

  const handleTextSubmit = () => {
    if (businessQuery.trim().length > 0) {
      const plan = createDynamicBusinessPlan(businessQuery.trim());
      setActiveBusiness(plan);
      navigateTo('my_plan');
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
      householdEssentialExpenses: sector.presets.personalCost,
      personalCost: sector.presets.personalCost,
      availableMarginCapital: null,
      householdIncome: null,
      existingEMI: null,
      requestedLoanAmount: null,
      presetSource: 'SUGGESTED_ESTIMATE',
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
          {t('greeting_prefix') || 'Namaste'}, {user.firstName || t('user_placeholder') || ''} 🙏
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

        {/* Check My Business Plan — Guided Interview */}
        <TouchableOpacity
          style={[styles.voiceHeroCard, { backgroundColor: '#3f6653', marginTop: 15 }]}
          onPress={() => router.push('/rural-interview' as any)}
          activeOpacity={0.88}
        >
          <View style={[styles.voiceHeroMicWrap, { backgroundColor: '#beead1' }]}>
            <Text style={{ fontSize: 24 }}>📋</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.voiceHeroTitle, { color: '#ffffff' }]}>
              {t('check_business_plan') || 'Check My Business Plan'}
            </Text>
            <Text style={[styles.voiceHeroSub, { color: '#e0e0e0' }]}>
              {t('check_business_plan_sub') || 'बोलकर अपना बिज़नेस जांचें'}
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
      householdEssentialExpenses: sector.presets.personalCost,
      personalCost: sector.presets.personalCost,
      availableMarginCapital: null,
      householdIncome: null,
      existingEMI: null,
      requestedLoanAmount: null,
      presetSource: 'SUGGESTED_ESTIMATE',
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

function parseNumOrNull(val: string): number | null {
  const trimmed = (val ?? '').trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return isNaN(num) ? null : num;
}

// ----------------------------------------------------
// BUSINESS DETAILS / EDIT DETAILS (WITH NUMERIC VOICE INPUT)
// Canonical inputs only — zero fallback financial values (Sections A, C, D, E, F)
// ----------------------------------------------------
function BusinessDetailsScreen() {
  const { activeBusiness, setActiveBusiness, navigateTo, currentLang, t } = useApp();

  const isPreset = activeBusiness?.presetSource === 'SUGGESTED_ESTIMATE';

  // Field provenance tracking (Section F)
  const [fieldProvenance, setFieldProvenance] = useState<Record<string, string>>(() => {
    const fields = [
      'setupCost',
      'salesPerMonth',
      'pricePerUnit',
      'costPerUnit',
      'monthlyFixed',
      'availableMarginCapital',
      'householdEssentialExpenses',
      'householdIncome',
      'existingEMI',
      'requestedLoanAmount',
    ];
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f] = isPreset ? 'SUGGESTED_ESTIMATE' : 'USER_PROVIDED';
    }
    return initial;
  });

  // State initialized using editableValue helper without ANY fallback values (Section A)
  const [setupCost, setSetupCost] = useState(editableValue(activeBusiness?.setupCost));
  const [monthlyFixed, setMonthlyFixed] = useState(editableValue(activeBusiness?.monthlyFixed));
  const [pricePerUnit, setPricePerUnit] = useState(editableValue(activeBusiness?.pricePerUnit));
  const [costPerUnit, setCostPerUnit] = useState(editableValue(activeBusiness?.costPerUnit));
  const [salesPerMonth, setSalesPerMonth] = useState(editableValue(activeBusiness?.salesPerMonth));
  const [availableMarginCapital, setAvailableMarginCapital] = useState(editableValue(activeBusiness?.availableMarginCapital));

  // Household fields (Section D, E)
  const [householdEssentialExpenses, setHouseholdEssentialExpenses] = useState(
    editableValue(activeBusiness?.householdEssentialExpenses ?? activeBusiness?.personalCost)
  );
  const [householdIncome, setHouseholdIncome] = useState(editableValue(activeBusiness?.householdIncome));
  const [existingEMI, setExistingEMI] = useState(editableValue(activeBusiness?.existingEMI));

  // Optional requested loan (Section E)
  const [requestedLoanAmount, setRequestedLoanAmount] = useState(editableValue(activeBusiness?.requestedLoanAmount));

  // Active numeric voice modal state
  const [voiceTargetField, setVoiceTargetField] = useState<{
    id: string;
    label: string;
    setter: (val: string) => void;
  } | null>(null);

  const handleFieldChange = (field: string, val: string, setter: (v: string) => void) => {
    setter(val);
    setFieldProvenance((prev) => ({ ...prev, [field]: 'USER_PROVIDED' }));
  };

  const handleDontKnow = (field: string, setter: (v: string) => void) => {
    setter('');
    setFieldProvenance((prev) => ({ ...prev, [field]: 'USER_PROVIDED' }));
  };

  const numSetup = parseNumOrNull(setupCost);
  const numFixed = parseNumOrNull(monthlyFixed);
  const numPrice = parseNumOrNull(pricePerUnit);
  const numCost = parseNumOrNull(costPerUnit);
  const numSales = parseNumOrNull(salesPerMonth);
  const numMargin = parseNumOrNull(availableMarginCapital);
  const numHouseholdExp = parseNumOrNull(householdEssentialExpenses);
  const numHouseholdInc = parseNumOrNull(householdIncome);
  const numExistingEMI = parseNumOrNull(existingEMI);
  const numLoan = parseNumOrNull(requestedLoanAmount);

  // Canonical analytics snapshot for live preview — NO UI financial calculations
  const previewPlanInputs: BusinessPlanInputs = useMemo(() => ({
    monthlyUnitsSold: numSales,
    sellingPricePerUnit: numPrice,
    variableCostPerUnit: numCost,
    monthlyBusinessFixedCost: numFixed,
    setupCost: numSetup,
    availableMarginCapital: numMargin,
    householdEssentialExpenses: numHouseholdExp,
    householdNonBusinessIncome: numHouseholdInc,
    existingHouseholdEMI: numExistingEMI,
    requestedLoanAmount: numLoan,
  }), [numSales, numPrice, numCost, numFixed, numSetup, numMargin, numHouseholdExp, numHouseholdInc, numExistingEMI, numLoan]);

  const liveSnapshot = useMemo(() => generateAnalyticsSnapshot(previewPlanInputs), [previewPlanInputs]);
  const monthlyRevenue = liveSnapshot.monthlyRevenue;
  const monthlyVariableCost = liveSnapshot.monthlyVariableCost;
  const operatingSurplus = liveSnapshot.operatingSurplus;

  const handleSaveAndViewPlan = () => {
    // Confirm all visible unedited preset fields on save (Section F)
    const updatedProvenance: Record<string, string> = { ...fieldProvenance };
    for (const key of Object.keys(updatedProvenance)) {
      if (updatedProvenance[key] === 'SUGGESTED_ESTIMATE') {
        updatedProvenance[key] = 'USER_CONFIRMED_ESTIMATE';
      }
    }

    setActiveBusiness((prev: any) => ({
      ...prev,
      setupCost: numSetup,
      monthlyFixed: numFixed,
      pricePerUnit: numPrice,
      costPerUnit: numCost,
      salesPerMonth: numSales,
      availableMarginCapital: numMargin,
      householdEssentialExpenses: numHouseholdExp,
      personalCost: numHouseholdExp, // keep compatibility
      householdIncome: numHouseholdInc,
      existingEMI: numExistingEMI,
      requestedLoanAmount: numLoan,
      presetSource: isPreset ? 'USER_CONFIRMED_ESTIMATE' : (prev?.presetSource || ''),
      fieldProvenance: updatedProvenance,
    }));
    navigateTo('my_plan');
  };

  const fmt = (n: number | null) => (n !== null ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>
          {t('business_financials_title') || 'Business Financials'}
        </Text>
        <Text style={styles.screenHeaderSub}>
          {activeBusiness?.title || 'Business'} - {t('edit_details_sub') || 'Edit Details'}
        </Text>
      </View>

      {/* Preset estimate notification (Section F) */}
      {isPreset && (
        <View style={[styles.card, { backgroundColor: '#fff8e1', borderColor: '#ffe082', marginBottom: 10 }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#f57f17' }}>
            ⚠ {t('suggested_estimate_notice') || 'Suggested starting estimates — confirm or edit'}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 4 }}>
            {t('suggested_estimate_sub') || 'Values below are sector benchmarks. Review and edit to match your reality.'}
          </Text>
        </View>
      )}

      {/* 1. SETUP COSTS & FINANCING (Section E) */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>{t('setup_costs_section') || 'Setup Costs & Capital'}</Text>

        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('initial_investment') || 'Initial Investment / Setup Cost (₹)'}</Text>
            <TouchableOpacity
              style={styles.micInputBadge}
              onPress={() =>
                setVoiceTargetField({
                  id: 'setupCost',
                  label: t('initial_investment') || 'Initial Investment',
                  setter: (val) => handleFieldChange('setupCost', val, setSetupCost),
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
            placeholder="e.g. 95000"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('setupCost', val, setSetupCost)}
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('available_margin_capital') || 'Available Own / Margin Capital (₹)'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => handleDontKnow('availableMarginCapital', setAvailableMarginCapital)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: COLORS.outline, textDecorationLine: 'underline' }}>
                  {t('dont_know_yet') || "Don't know yet"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.micInputBadge}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'availableMarginCapital',
                    label: t('available_margin_capital') || 'Available Margin Capital',
                    setter: (val) => handleFieldChange('availableMarginCapital', val, setAvailableMarginCapital),
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13 }}>🎙️</Text>
                <Text style={styles.micInputBadgeText}>Speak</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={availableMarginCapital}
            placeholder="Own savings to invest (optional)"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('availableMarginCapital', val, setAvailableMarginCapital)}
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('requested_loan_amount') || 'Requested Loan Amount (₹) [Optional]'}</Text>
            <TouchableOpacity
              onPress={() => handleDontKnow('requestedLoanAmount', setRequestedLoanAmount)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, color: COLORS.outline, textDecorationLine: 'underline' }}>
                {t('dont_know_yet') || "Don't know yet"}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={requestedLoanAmount}
            placeholder="Leave empty to let Aarthika recommend"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('requestedLoanAmount', val, setRequestedLoanAmount)}
          />
        </View>
      </View>

      {/* 2. MONTHLY BUSINESS ECONOMICS (Sections A, D) */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>
          {t('monthly_economics_section') || 'Monthly Business Economics'}
        </Text>

        {/* Row 1: Sales/Month & Unit Price */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('sales_per_month') || 'Monthly Units Sold'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'salesPerMonth',
                    label: t('sales_per_month') || 'Monthly Units Sold',
                    setter: (val) => handleFieldChange('salesPerMonth', val, setSalesPerMonth),
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
              placeholder="e.g. 1800"
              placeholderTextColor={COLORS.outline}
              onChangeText={(val) => handleFieldChange('salesPerMonth', val, setSalesPerMonth)}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('unit_price') || 'Selling Price (₹)'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'pricePerUnit',
                    label: t('unit_price') || 'Selling Price per Unit',
                    setter: (val) => handleFieldChange('pricePerUnit', val, setPricePerUnit),
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
              placeholder="e.g. 40"
              placeholderTextColor={COLORS.outline}
              onChangeText={(val) => handleFieldChange('pricePerUnit', val, setPricePerUnit)}
            />
          </View>
        </View>

        {/* Row 2: Variable Cost & Monthly Fixed Cost */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('unit_cost') || 'Var Cost / Unit (₹)'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'costPerUnit',
                    label: t('unit_cost') || 'Variable Cost per Unit',
                    setter: (val) => handleFieldChange('costPerUnit', val, setCostPerUnit),
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
              placeholder="e.g. 18"
              placeholderTextColor={COLORS.outline}
              onChangeText={(val) => handleFieldChange('costPerUnit', val, setCostPerUnit)}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel} numberOfLines={1}>{t('fixed_costs') || 'Fixed Cost/Mo (₹)'}</Text>
              <TouchableOpacity
                style={styles.micSmallBtn}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'monthlyFixed',
                    label: t('fixed_costs') || 'Monthly Business Fixed Cost',
                    setter: (val) => handleFieldChange('monthlyFixed', val, setMonthlyFixed),
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
              placeholder="e.g. 4000"
              placeholderTextColor={COLORS.outline}
              onChangeText={(val) => handleFieldChange('monthlyFixed', val, setMonthlyFixed)}
            />
          </View>
        </View>

        {/* Live Business Economics Preview — from canonical analytics snapshot (Section D) */}
        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 10, paddingTop: 10 }}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('monthly_revenue_label') || 'Estimated Monthly Revenue'}</Text>
            <Text style={styles.breakdownValue}>{fmt(monthlyRevenue)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('variable_cost_label') || 'Estimated Monthly Variable Cost'}</Text>
            <Text style={styles.breakdownValue}>{monthlyVariableCost != null ? `−${fmt(monthlyVariableCost)}` : fmt(null)}</Text>
          </View>
          <View style={[styles.breakdownRow, { marginTop: 4 }]}>
            <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>
              {t('operating_surplus') || 'Business Operating Surplus'}
            </Text>
            <Text style={[styles.breakdownValue, { fontWeight: '800', color: (operatingSurplus ?? 0) >= 0 ? COLORS.secondary : COLORS.error }]}>
              {fmt(operatingSurplus)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: COLORS.outline, marginTop: 2 }}>
            {t('surplus_note') || 'Revenue − Variable Costs − Business Fixed Costs (excludes household expenses)'}
          </Text>
        </View>
      </View>

      {/* 3. HOUSEHOLD AFFORDABILITY INPUTS (Sections D, E) */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>
          {t('household_affordability_section') || 'Household Affordability (Optional)'}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, marginBottom: 10 }}>
          {t('household_desc') || 'Used only to evaluate household debt capacity. Does not change business operating surplus.'}
        </Text>

        {/* Essential Expenses */}
        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('household_expenses') || 'Essential Monthly Living Expenses (₹)'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => handleDontKnow('householdEssentialExpenses', setHouseholdEssentialExpenses)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: COLORS.outline, textDecorationLine: 'underline' }}>
                  {t('dont_know_yet') || "Don't know yet"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.micInputBadge}
                onPress={() =>
                  setVoiceTargetField({
                    id: 'householdEssentialExpenses',
                    label: t('household_expenses') || 'Household Living Expenses',
                    setter: (val) => handleFieldChange('householdEssentialExpenses', val, setHouseholdEssentialExpenses),
                  })
                }
              >
                <Text style={{ fontSize: 13 }}>🎙️</Text>
                <Text style={styles.micInputBadgeText}>Speak</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={householdEssentialExpenses}
            placeholder="e.g. 8000"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('householdEssentialExpenses', val, setHouseholdEssentialExpenses)}
          />
        </View>

        {/* Other Income */}
        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('household_income') || 'Other Monthly Household Income (₹)'}</Text>
            <TouchableOpacity
              onPress={() => handleDontKnow('householdIncome', setHouseholdIncome)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, color: COLORS.outline, textDecorationLine: 'underline' }}>
                {t('dont_know_yet') || "Don't know yet"}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={householdIncome}
            placeholder="e.g. 5000 (from agriculture, other jobs)"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('householdIncome', val, setHouseholdIncome)}
          />
        </View>

        {/* Existing EMI */}
        <View style={styles.inputContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.inputLabel}>{t('existing_emi') || 'Existing Monthly EMI / Loan Payments (₹)'}</Text>
            <TouchableOpacity
              onPress={() => handleDontKnow('existingEMI', setExistingEMI)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, color: COLORS.outline, textDecorationLine: 'underline' }}>
                {t('dont_know_yet') || "Don't know yet"}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={existingEMI}
            placeholder="e.g. 0 or existing loan EMI"
            placeholderTextColor={COLORS.outline}
            onChangeText={(val) => handleFieldChange('existingEMI', val, setExistingEMI)}
          />
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
          onPress={handleSaveAndViewPlan}
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
// MY PLAN SCREEN — Uses canonical analytics snapshot.
// Business economics and household affordability are SEPARATE.
// ----------------------------------------------------
function MyPlanScreen() {
  const { activeBusiness, navigateTo, setActiveBusinessId, user, t } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build canonical plan inputs from activeBusiness using null-safe ?? undefined (Section G)
  const planInputs: BusinessPlanInputs = {
    businessCategory: activeBusiness?.sector || undefined,
    businessTitle: activeBusiness?.title || undefined,
    setupCost: activeBusiness?.setupCost ?? undefined,
    availableMarginCapital: activeBusiness?.availableMarginCapital ?? undefined,
    monthlyUnitsSold: activeBusiness?.salesPerMonth ?? undefined,
    sellingPricePerUnit: activeBusiness?.pricePerUnit ?? undefined,
    variableCostPerUnit: activeBusiness?.costPerUnit ?? undefined,
    monthlyBusinessFixedCost: activeBusiness?.monthlyFixed ?? undefined,
    householdEssentialExpenses: (activeBusiness?.householdEssentialExpenses ?? activeBusiness?.personalCost) ?? undefined,
    householdNonBusinessIncome: activeBusiness?.householdIncome ?? undefined,
    existingHouseholdEMI: activeBusiness?.existingEMI ?? undefined,
    requestedLoanAmount: activeBusiness?.requestedLoanAmount ?? undefined,
  };

  // Generate the canonical analytics snapshot
  const snapshot = generateAnalyticsSnapshot(planInputs);

  const setupCost = activeBusiness?.setupCost ?? 0;
  const breakdown = activeBusiness?.breakdown?.length ? activeBusiness.breakdown : [];
  const isPreset = activeBusiness?.presetSource === 'SUGGESTED_ESTIMATE';

  const fmt = (n: number | null | undefined) => {
    if (n == null) return t('need_info') || 'Need more information';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const fmtStatus = (status: string | null | undefined) => {
    if (!status) return t('need_info') || 'Need more information';
    if (status === 'NO_FINITE_BREAK_EVEN') return t('no_finite_breakeven') || 'No finite break-even';
    if (status === 'STRUCTURALLY_UNVIABLE') return t('structurally_unviable') || 'Current price/cost structure cannot break even';
    if (status === 'VIABLE') return t('viable') || 'Viable';
    if (status === 'READY_FOR_FINANCE_REVIEW') return '✅ ' + (t('ready_for_review') || 'Ready for Review');
    if (status === 'HIGH_RISK') return '⚠️ ' + (t('high_risk') || 'High Risk');
    if (status === 'OUT_OF_SCOPE') return '🚫 ' + (t('out_of_scope') || 'OUT_OF_SCOPE');
    if (status === 'INCOMPLETE') return '📝 ' + (t('incomplete') || 'Incomplete');
    if (status === 'INSUFFICIENT_DATA') return '📝 ' + (t('insufficient_data') || 'Need more information');
    return status;
  };

  const handleRunRiskTest = async () => {
    setIsSubmitting(true);
    try {
      // Backend business creation only if authenticated with valid backendUserId (Section I)
      if (isBackendConfigured && user?.backendUserId) {
        const businessData = {
          user_id: user.backendUserId,
          business_name: activeBusiness.title || 'Business Plan',
          business_category: activeBusiness.sector || 'custom',
          description: JSON.stringify(activeBusiness),
          status: 'DRAFT',
        };
        try {
          const response = await api.business.createBusiness(businessData);
          if (response && response.id) {
            try {
              await api.business.createAssumption(response.id, buildAssumptionsPayload(activeBusiness, response.id));
              setActiveBusinessId(response.id);
            } catch (assumptionErr) {
              console.warn('Failed to persist assumptions:', (assumptionErr as Error).message);
              setActiveBusinessId(null);
            }
          }
        } catch (e) {
          console.warn('Backend unavailable, continuing with local engine:', (e as Error).message);
          setActiveBusinessId(null);
        }
      } else {
        // Stay local/offline - do NOT fake a backend user ID (Section I)
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
        <Text style={styles.screenHeaderSub}>{activeBusiness.title || 'Business'} - {t('phase_1_sub') || 'Phase 1'}</Text>
      </View>

      {/* Preset notice */}
      {isPreset && (
        <View style={[styles.card, { backgroundColor: '#fff8e1', borderColor: '#ffe082' }]}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#f57f17' }}>
            {t('suggested_estimate_notice') || '⚠ Suggested starting estimates — please confirm or edit'}
          </Text>
        </View>
      )}

      {setupCost > 0 && (
        <View style={styles.bentoCard}>
          <Text style={styles.bentoLabel}>{t('setup_costs_card') || 'Setup Costs'}</Text>
          <Text style={styles.bentoValuePrimary}>{fmt(setupCost)}</Text>
          <Text style={styles.bentoSub}>{t('initial_inv_sub') || 'Initial investment required'}</Text>
        </View>
      )}

      {/* Business Economics — NO household data mixed in (Section D) */}
      <View style={[styles.card, { marginTop: 8 }]}>
        <Text style={styles.cardSectionTitle}>{t('business_economics') || 'Business Economics'}</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('monthly_revenue_label') || 'Monthly Revenue'}</Text>
          <Text style={styles.breakdownValue}>{fmt(snapshot.monthlyRevenue)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('variable_cost_label') || 'Monthly Variable Cost'}</Text>
          <Text style={styles.breakdownValue}>{snapshot.monthlyVariableCost != null ? `−${fmt(snapshot.monthlyVariableCost)}` : fmt(null)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('fixed_costs') || 'Monthly Fixed Business Cost'}</Text>
          <Text style={styles.breakdownValue}>{snapshot.monthlyFixedCost != null ? `−${fmt(snapshot.monthlyFixedCost)}` : fmt(null)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('contribution_margin') || 'Contribution Margin/Unit'}</Text>
          <Text style={[styles.breakdownValue, { color: (snapshot.contributionMargin ?? 0) >= 0 ? COLORS.secondary : COLORS.error }]}>{fmt(snapshot.contributionMargin)}</Text>
        </View>
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 4, paddingTop: 8 }]}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>{t('operating_surplus') || 'Operating Surplus'}</Text>
          <Text style={[styles.breakdownValue, { fontWeight: '800', color: (snapshot.operatingSurplus ?? 0) >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(snapshot.operatingSurplus)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('breakeven_units') || 'Break-even Units'}</Text>
          <Text style={styles.breakdownValue}>
            {snapshot.breakEvenStatus === 'VIABLE' ? `${snapshot.breakEvenUnits} units` : fmtStatus(snapshot.breakEvenStatus)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('breakeven_rev_label') || 'Break-even Revenue'}</Text>
          <Text style={styles.breakdownValue}>{fmt(snapshot.breakEvenRevenue)}</Text>
        </View>
      </View>

      {/* Financing — only if margin capital or loan is available */}
      {(snapshot.candidateEmi != null || snapshot.schemeTerms || snapshot.financingAnalysisStatus === 'OUT_OF_SCOPE') && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.cardSectionTitle}>{t('financing_analysis') || 'Financing Analysis'}</Text>
          {snapshot.financingAnalysisStatus === 'OUT_OF_SCOPE' || snapshot.schemeTerms?.isOutOfScope ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t('financing_status') || 'Financing Status'}</Text>
              <Text style={[styles.breakdownValue, { color: COLORS.error, fontWeight: '700' }]}>OUT_OF_SCOPE</Text>
            </View>
          ) : (
            <>
              {snapshot.schemeTerms && !snapshot.schemeTerms.isOutOfScope && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('scheme_type') || 'Scheme'}</Text>
                  <Text style={styles.breakdownValue}>{snapshot.schemeTerms.schemeName} @ {snapshot.schemeTerms.interestRate}%</Text>
                </View>
              )}
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('candidate_emi') || 'Candidate EMI'}</Text>
                <Text style={styles.breakdownValue}>{fmt(snapshot.candidateEmi)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('business_dscr') || 'Business DSCR'}</Text>
                <Text style={[styles.breakdownValue, { color: (snapshot.businessDscr ?? 0) >= AARTHIKA_CALCULATION_POLICY.minimum_required_dscr ? COLORS.secondary : COLORS.error }]}>
                  {snapshot.businessDscr != null ? snapshot.businessDscr.toFixed(2) : fmt(null)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('max_affordable_emi') || 'Max Affordable EMI'}</Text>
                <Text style={styles.breakdownValue}>{fmt(snapshot.maximumAffordableEmi)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('affordable_loan') || 'Affordable Loan Amount'}</Text>
                <Text style={styles.breakdownValue}>{fmt(snapshot.affordableLoanAmount)}</Text>
              </View>
              {snapshot.recommendedLoanAmount != null && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('recommended_loan') || 'Recommended Loan'}</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.secondary }]}>{fmt(snapshot.recommendedLoanAmount)}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Household Affordability — completely separate */}
      <View style={[styles.card, { marginTop: 8 }]}>
        <Text style={styles.cardSectionTitle}>{t('household_affordability') || 'Household Affordability'}</Text>
        {snapshot.householdAnalysisAvailable ? (
          <>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t('household_debt_ratio') || 'Post-Loan Debt Ratio'}</Text>
              <Text style={[styles.breakdownValue, { color: (snapshot.householdDebtRatio ?? 0) <= AARTHIKA_CALCULATION_POLICY.maximum_household_debt_ratio ? COLORS.secondary : COLORS.error }]}>
                {snapshot.householdDebtRatio != null ? `${(snapshot.householdDebtRatio * 100).toFixed(0)}%` : fmt(null)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t('household_status') || 'Household Status'}</Text>
              <Text style={styles.breakdownValue}>{fmtStatus(snapshot.financeResult.household_affordability_status)}</Text>
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, fontStyle: 'italic' }}>
            {t('household_insufficient') || 'Household income/expense data not provided — household analysis not available.'}
          </Text>
        )}
      </View>

      {/* Overall Readiness */}
      <View style={[styles.bentoCard, { backgroundColor: COLORS.secondaryContainer, marginTop: 8 }]}>
        <Text style={[styles.bentoLabel, { color: COLORS.secondary }]}>
          {t('overall_readiness') || 'Overall Readiness'}
        </Text>
        <Text style={[styles.bentoValueSecondary, { fontSize: 18 }]}>
          {fmtStatus(snapshot.overallReadiness)}
        </Text>
        <Text style={[styles.bentoSub, { color: COLORS.onSecondaryContainer }]}>
          {snapshot.businessAnalysisAvailable ? '✅ ' + (t('business_analysis_available') || 'Business analysis available') : '📝 ' + (t('business_analysis_needed') || 'Business data needed')}
          {'  ·  '}
          {snapshot.householdAnalysisAvailable ? '✅ ' + (t('household_analysis') || 'Household') : '📝 ' + (t('household_data_needed') || 'Household data needed')}
        </Text>
      </View>

      {/* Plan Breakdown */}
      {breakdown.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.cardSectionTitle}>{t('plan_breakdown_section') || 'Plan Cost Breakdown'}</Text>
          {breakdown.map((item: any, i: number) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <Text style={styles.breakdownValue}>{fmt(item.cost || 0)}</Text>
            </View>
          ))}
        </View>
      )}

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
    </ScrollView>
  );
}

// ----------------------------------------------------
// RISK TEST SCREEN — Uses canonical analytics snapshot.
// NO fake fallback reports. Backend failure → local deterministic report.
// ----------------------------------------------------
function RiskTestScreen() {
  const { activeBusinessId, setActiveBusinessId, activeBusiness, aiReport, setAiReport, user, currentLang, t } = useApp();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [reportStatus, setReportStatus] = useState<string>('LOADING');

  // Build canonical plan inputs using null-safe ?? undefined (Section G)
  const planInputs: BusinessPlanInputs = {
    businessCategory: activeBusiness?.sector || undefined,
    businessTitle: activeBusiness?.title || undefined,
    setupCost: activeBusiness?.setupCost ?? undefined,
    availableMarginCapital: activeBusiness?.availableMarginCapital ?? undefined,
    monthlyUnitsSold: activeBusiness?.salesPerMonth ?? undefined,
    sellingPricePerUnit: activeBusiness?.pricePerUnit ?? undefined,
    variableCostPerUnit: activeBusiness?.costPerUnit ?? undefined,
    monthlyBusinessFixedCost: activeBusiness?.monthlyFixed ?? undefined,
    householdEssentialExpenses: (activeBusiness?.householdEssentialExpenses ?? activeBusiness?.personalCost) ?? undefined,
    householdNonBusinessIncome: activeBusiness?.householdIncome ?? undefined,
    existingHouseholdEMI: activeBusiness?.existingEMI ?? undefined,
    requestedLoanAmount: activeBusiness?.requestedLoanAmount ?? undefined,
  };

  const handleHearSummary = () => {
    const d = dashboardData?.recommendation;
    if (!d) return;
    const summary = `${d.decision || ''}. ${d.rationale || 'Analysis complete.'}`;
    speak(summary, currentLang);
  };

  const isGeneratingRef = useRef(false);

  const generateReport = async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setLoading(true);
    setReportStatus('LOADING');

    try {
      // Generate local deterministic snapshot FIRST (authoritative)
      const snapshot = generateAnalyticsSnapshot(planInputs);
      const localDashboard = snapshotToDashboardData(snapshot);

      // Try backend AI report for enhanced explanations (only if backendUser exists — Section I)
      let backendReport = null;
      if (isBackendConfigured && user?.backendUserId) {
        let bizId = activeBusinessId;
        if (!bizId) {
          try {
            const businessData = {
              user_id: user.backendUserId,
              business_name: activeBusiness?.title || 'Business Plan',
              business_category: activeBusiness?.sector || 'custom',
              description: JSON.stringify(activeBusiness || {}),
              status: 'DRAFT',
            };
            const created = await api.business.createBusiness(businessData);
            if (created?.id) {
              bizId = created.id;
              setActiveBusinessId(bizId);
              try {
                await api.business.createAssumption(created.id, buildAssumptionsPayload(activeBusiness || {}, created.id));
              } catch (_e) { /* ignore */ }
            }
          } catch (createErr) {
            console.warn('Auto-create failed:', (createErr as Error).message);
          }
        }

        if (bizId) {
          try {
            backendReport = await api.aiReports.generateReport(bizId);
            setAiReport(backendReport);
          } catch (apiErr) {
            console.warn('Backend AI report unavailable, using local deterministic:', (apiErr as Error).message);
          }
        }
      }

      // Only merge backend explanation if input_hash and policy_version match local deterministic snapshot (Section W)
      const bSnapshot = backendReport?.deterministic_snapshot;
      const bHash = bSnapshot?.input_hash || backendReport?.input_hash;
      const bPolicy = bSnapshot?.policy_version || backendReport?.policy_version;
      const hashesMatch = bHash === snapshot.inputHash;
      const policyMatch = bPolicy === snapshot.policyVersion;

      if (backendReport && hashesMatch && policyMatch) {
        const explanation = backendReport.explanation || backendReport;
        localDashboard.recommendation.rationale = explanation.summary || localDashboard.recommendation.rationale;
        localDashboard.recommendation.supportingPoints = [
          explanation.deterministic_findings_explained || '',
          ...(explanation.caveats || []),
        ].filter(Boolean);
        localDashboard.recommendation.actionItems = explanation.suggested_next_steps || localDashboard.recommendation.actionItems;
        if (backendReport.market_data_status === 'VERIFIED_DATA') {
          localDashboard.marketDataStatus = 'VERIFIED_DATA';
          if (localDashboard.provenance) {
            localDashboard.provenance.marketData = 'VERIFIED_DATA';
          }
        }
        setReportStatus('READY');
      } else {
        setReportStatus(snapshot.businessAnalysisAvailable ? 'PARTIAL' : 'INSUFFICIENT_DATA');
      }

      setDashboardData(localDashboard);
    } catch (e) {
      console.error('[RiskTestScreen] Report generation error:', e);
      // Even on error, produce a local deterministic report
      try {
        const snapshot = generateAnalyticsSnapshot(planInputs);
        setDashboardData(snapshotToDashboardData(snapshot));
        setReportStatus(snapshot.businessAnalysisAvailable ? 'PARTIAL' : 'INSUFFICIENT_DATA');
      } catch (localErr) {
        console.error('[RiskTestScreen] Local analytics also failed:', localErr);
        setReportStatus('ERROR');
      }
    } finally {
      setLoading(false);
      isGeneratingRef.current = false;
    }
  };

  useEffect(() => {
    const tId = setTimeout(() => {
      generateReport();
    }, 0);
    return () => clearTimeout(tId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>{t('reality_check_title') || 'Reality Check & Risk'}</Text>
        <Text style={styles.screenHeaderSub}>
          {reportStatus === 'PARTIAL_OFFLINE'
            ? t('local_analysis_sub') || 'Deterministic Local Analysis'
            : t('ai_analysis_sub') || 'Business Analytics'}
        </Text>
      </View>

      {!loading && dashboardData && (
        <TouchableOpacity
          style={[styles.demoButton, { marginHorizontal: 20, marginBottom: 12 }]}
          onPress={handleHearSummary}
          activeOpacity={0.8}
        >
          <Text style={[styles.demoButtonText, { color: COLORS.secondary }]}>
            {t('hear_ai_verdict') || '🔊 Hear Summary'}
          </Text>
        </TouchableOpacity>
      )}

      {reportStatus === 'ERROR' && (
        <View style={[styles.card, { padding: 16, alignItems: 'center' }]}>
          <Text style={{ fontSize: 14, color: COLORS.error, textAlign: 'center' }}>
            {t('analysis_error') || 'Financial analysis could not be completed. Please try again.'}
          </Text>
        </View>
      )}

      {loading && !dashboardData ? (
        <View style={[styles.card, { padding: 30, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>📊</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' }}>
            {t('analyzing_title') || 'Analyzing your business plan...'}
          </Text>
        </View>
      ) : dashboardData ? (
        <RiskAnalysisDashboard riskData={dashboardData} />
      ) : null}
    </ScrollView>
  );
}

// ----------------------------------------------------
// PROFILE SCREEN (FULLY LOCALIZED)
// ----------------------------------------------------
function ProfileScreen() {
  const { user, handleLogout, setIsLangModalOpen, currentLang, t, navigateTo } = useApp();

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
        <Text style={styles.profileName}>{user.fullName || t('not_provided') || 'Not provided'}</Text>
        <View style={styles.profileLocationBadge}>
          <Text style={styles.profileLocationText}>
            📍 {user.village ? `${user.village}, ` : ''}{user.district || t('not_provided') || 'Not provided'}{user.state ? `, ${user.state}` : ''}
          </Text>
        </View>
      </View>

      {/* Profile Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>{t('profile_info_section') || 'Profile Information'}</Text>
        
        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('mobile_number') || 'Mobile Number'}</Text>
          <Text style={styles.profileInfoValue}>{user.mobile || t('not_provided') || 'Not provided'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('age_dob') || 'Age'}</Text>
          <Text style={styles.profileInfoValue}>{user.age ? `${user.age} years` : t('not_provided') || 'Not provided'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('current_occupation') || 'Occupation'}</Text>
          <Text style={styles.profileInfoValue}>{user.occupation || t('not_provided') || 'Not provided'}</Text>
        </View>

        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>{t('interested_business') || 'Interested Business'}</Text>
          <Text style={styles.profileInfoValue}>{user.interestedSector || t('not_provided') || 'Not provided'}</Text>
        </View>

        <View style={[styles.profileInfoItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.profileInfoLabel}>{t('village_town') || 'Village / Town'}</Text>
          <Text style={styles.profileInfoValue}>
            {user.village || t('not_provided') || 'Not provided'}{user.district ? ` (${user.district})` : ''}
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

      <TouchableOpacity
        style={[styles.outlineButton, { marginTop: 12, borderColor: COLORS.secondary }]}
        onPress={() => {
          stopSpeaking();
          navigateTo('touchless_auth');
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.outlineButtonText, { color: COLORS.secondary }]}>
          🎙️ {t('update_voice_profile') || 'Update Voice Profile / Re-speak'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>{t('log_out') || 'Log Out'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ----------------------------------------------------
// TOUCHLESS VOICE ONBOARDING & LOGIN SCREEN
// Collects: 1. Name, 2. Place, 3. Occupation, 4. Age
// Touchless speech guidance via TTS and hands-free STT listening
// Accessible tactile fallback for typing, editing, and instant restore
// ----------------------------------------------------
function TouchlessAuthScreen() {
  const { currentLang, saveTouchlessProfile, navigateTo, t, setIsLangModalOpen } = useApp();

  const [step, setStep] = useState(0); // 0: Name, 1: Place, 2: Occupation, 3: Age, 4: Ready
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [storedProfile, setStoredProfile] = useState<any>(null);

  // Animated pulse for mic
  const [pulseAnim] = useState(() => new Animated.Value(0));
  const [waveAnim1] = useState(() => new Animated.Value(6));
  const [waveAnim2] = useState(() => new Animated.Value(14));
  const [waveAnim3] = useState(() => new Animated.Value(10));
  const [waveAnim4] = useState(() => new Animated.Value(18));

  // Refs for speech timers
  const speechTimerRef = useRef<any>(null);
  const finishTimerRef = useRef<any>(null);
  const promptSequenceRef = useRef(0);

  // Check for previous profile in AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@touchless_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.name || parsed.fullName)) {
            setStoredProfile(parsed);
          }
        } else {
          const userRaw = await AsyncStorage.getItem('@user');
          if (userRaw) {
            const parsedUser = JSON.parse(userRaw);
            if (parsedUser && (parsedUser.fullName || parsedUser.firstName)) {
              setStoredProfile({
                name: parsedUser.fullName || parsedUser.firstName,
                place: parsedUser.village || parsedUser.district || '',
                occupation: parsedUser.occupation || '',
                age: parsedUser.age || '',
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load stored profile', e);
      }
    })();
  }, []);

  // Pulsing animation loop
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Wave animation loop
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(waveAnim1, { toValue: 18, duration: 350, useNativeDriver: false }),
          Animated.timing(waveAnim2, { toValue: 8, duration: 400, useNativeDriver: false }),
          Animated.timing(waveAnim3, { toValue: 22, duration: 320, useNativeDriver: false }),
          Animated.timing(waveAnim4, { toValue: 10, duration: 450, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(waveAnim1, { toValue: 8, duration: 400, useNativeDriver: false }),
          Animated.timing(waveAnim2, { toValue: 20, duration: 320, useNativeDriver: false }),
          Animated.timing(waveAnim3, { toValue: 6, duration: 380, useNativeDriver: false }),
          Animated.timing(waveAnim4, { toValue: 16, duration: 350, useNativeDriver: false }),
        ]),
      ])
    );
    waveLoop.start();

    return () => {
      pulseLoop.stop();
      waveLoop.stop();
    };
  }, [pulseAnim, waveAnim1, waveAnim2, waveAnim3, waveAnim4]);

  // Questions configuration
  const questions = [
    {
      key: 'name',
      stepNum: 1,
      icon: '👤',
      title: currentLang === 'hi' ? 'आपका नाम क्या है?' : (t('auth_name_title') || 'What is your name?'),
      prompt: currentLang === 'hi' ? 'बोलकर अपना पूरा नाम बताएं' : (t('auth_name_prompt') || 'Speak your full name'),
      spoken: currentLang === 'hi'
        ? 'नमस्ते! आर्थिक में आपका स्वागत है। आपका शुभ नाम क्या है?'
        : (currentLang === 'bn'
            ? 'নমস্কার! আর্থিকা-তে আপনাকে স্বাগতম। আপনার নাম কি?'
            : 'Welcome to Aarthika! What is your name?'),
      placeholder: currentLang === 'hi' ? 'अपना नाम दर्ज करें (जैसे: परम नानकानी)' : 'Enter your name (e.g. Param Nankani)',
      value: name,
      setValue: setName,
    },
    {
      key: 'place',
      stepNum: 2,
      icon: '📍',
      title: currentLang === 'hi' ? 'आप कहाँ से हैं?' : (t('auth_place_title') || 'Where are you from?'),
      prompt: currentLang === 'hi' ? 'गाँव, कस्बे या शहर का नाम बोलें' : (t('auth_place_prompt') || 'Speak your village, town, or city'),
      spoken: currentLang === 'hi'
        ? 'बहुत अच्छा! आप किस गाँव या शहर से हैं?'
        : (currentLang === 'bn'
            ? 'খুব ভালো! আপনি কোন গ্রাম বা শহরের বাসিন্দা?'
            : 'Nice to meet you! What is your village, town, or city?'),
      placeholder: currentLang === 'hi' ? 'गाँव या शहर का नाम' : 'e.g. Pune / Varanasi',
      value: place,
      setValue: setPlace,
    },
    {
      key: 'occupation',
      stepNum: 3,
      icon: '💼',
      title: currentLang === 'hi' ? 'आप क्या काम करते हैं?' : (t('auth_occ_title') || 'What is your occupation?'),
      prompt: currentLang === 'hi' ? 'अपना व्यवसाय या कार्य बोलकर बताएं' : (t('auth_occ_prompt') || 'Speak your current work, trade, or business'),
      spoken: currentLang === 'hi'
        ? 'शानदार! आप क्या व्यवसाय या काम करते हैं?'
        : (currentLang === 'bn'
            ? 'চমৎকার! আপনি কি কাজ বা ব্যবসা করেন?'
            : 'What is your current work, trade, or occupation?'),
      placeholder: currentLang === 'hi' ? 'जैसे: दूध डेयरी, सिलाई, किराना दुकान' : 'e.g. Dairy Farming, Tailoring, Kirana Store',
      value: occupation,
      setValue: setOccupation,
    },
    {
      key: 'age',
      stepNum: 4,
      icon: '🎂',
      title: currentLang === 'hi' ? 'आपकी उम्र कितनी है?' : (t('auth_age_title') || 'What is your age?'),
      prompt: currentLang === 'hi' ? 'अपनी उम्र वर्षों में बोलें' : (t('auth_age_prompt') || 'Speak your age in years'),
      spoken: currentLang === 'hi'
        ? 'और आपकी उम्र कितने वर्ष है?'
        : (currentLang === 'bn'
            ? 'এবং আপনার বয়স কত বছর?'
            : 'And how old are you?'),
      placeholder: currentLang === 'hi' ? 'जैसे: 32 वर्ष' : 'e.g. 32',
      value: age,
      setValue: setAge,
    },
  ];

  // Helper to clean voice transcripts of speech fillers
  const cleanSpokenInput = (stepIndex: number, raw: string): string => {
    let text = raw.trim();
    if (!text) return '';

    if (stepIndex === 0) {
      // Name cleaning
      text = text.replace(/^(मेरा नाम|my name is|i am|iam|mera nam|humara naam|humara nam|naam hai|nam hai|naam|nam)\s+/i, '');
      text = text.replace(/\s+(hai|hoon|hu|jee|ji|sir|madam)$/i, '');
      // Capitalize first letters of words
      return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
    } else if (stepIndex === 1) {
      // Place cleaning
      text = text.replace(/^(मैं|hum|main|i live in|from|i am from|rehta hoon|rehti hoon|gaav|gaon|shahar|city|village|district)\s+/i, '');
      text = text.replace(/\s+(se hoon|se hu|mein rehta hoon|me rehte hai|se|mein|me)$/i, '');
      return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
    } else if (stepIndex === 2) {
      // Occupation cleaning
      text = text.replace(/^(मैं|hum|main|mera kaam|mera vyapar|my work is|my job is|i do|i work as)\s+/i, '');
      text = text.replace(/\s+(ka kaam|karta hoon|karti hoon|ka vyapar|ka business|hai|kare)$/i, '');
      return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
    } else if (stepIndex === 3) {
      // Age cleaning using numberParser
      const parsed = parseSpokenNumber(text);
      if (parsed.success && parsed.value !== null && parsed.value > 0) {
        return Math.min(100, Math.max(14, Math.round(parsed.value))).toString();
      }
      const digits = text.match(/\d{1,3}/);
      if (digits) {
        return digits[0];
      }
      return text;
    }
    return text;
  };

  // Process received speech result
  const handleSpeechReceived = (rawText: string) => {
    const cleaned = cleanSpokenInput(step, rawText);
    if (!cleaned) return;

    setIsListening(false);

    if (step === 0) {
      setName(cleaned);
      const ack = currentLang === 'hi' ? `नमस्ते ${cleaned} जी!` : `Hello ${cleaned}!`;
      speak(ack, currentLang, { onDone: () => setStep(prev => prev === 0 ? 1 : prev) });
    } else if (step === 1) {
      setPlace(cleaned);
      const ack = currentLang === 'hi' ? `${cleaned}, बहुत बढ़िया!` : `Great, from ${cleaned}!`;
      speak(ack, currentLang, { onDone: () => setStep(prev => prev === 1 ? 2 : prev) });
    } else if (step === 2) {
      setOccupation(cleaned);
      const ack = currentLang === 'hi' ? 'शानदार कार्य!' : 'Great occupation!';
      speak(ack, currentLang, { onDone: () => setStep(prev => prev === 2 ? 3 : prev) });
    } else if (step === 3) {
      setAge(cleaned);
      const ack = currentLang === 'hi' ? 'धन्यवाद! आपकी प्रोफ़ाइल तैयार है।' : 'Thank you! Your profile is ready.';
      speak(ack, currentLang, { onDone: () => setStep(prev => prev === 3 ? 4 : prev) });
    }
  };

  // Stop listening
  const stopListening = useCallback(() => {
    try {
      sttService.stopListening();
    } catch (_e) {
      // ignore
    }
    setIsListening(false);
  }, []);

  // Start speech recognition for current step
  const startListening = useCallback(async () => {
    await stopSpeaking();
    setError('');
    setLiveTranscript('');
    let finalTranscript = '';
    try {
      sttService.startListening({
        lang: currentLang,
        continuous: false,
        interimResults: true,
        onStart: () => {
          setIsListening(true);
        },
        onResult: (transcript: string, isFinal: boolean) => {
          setLiveTranscript(transcript);
          if (transcript.trim().length > 0) {
            questions[step]?.setValue(transcript);
          }
          if (isFinal && transcript.trim().length > 0) {
            finalTranscript = transcript.trim();
          }
        },
        onError: (err) => {
          setIsListening(false);
          if (err && typeof err === 'string') {
            setError(err);
          }
        },
        onEnd: () => {
          setIsListening(false);
          if (finalTranscript) handleSpeechReceived(finalTranscript);
        },
      });
    } catch (e) {
      setIsListening(false);
      console.warn('STT start failed:', e);
    }
  }, [currentLang, step]);

  const spokenPrompt = questions[step]?.spoken;

  // Listen only after the spoken prompt has finished and released the audio route.
  const playPromptAndListen = useCallback((stepIdx: number) => {
    if (stepIdx > 3) return;
    const sequence = ++promptSequenceRef.current;
    clearTimeout(speechTimerRef.current);
    try {
      sttService.stopListening();
    } catch (_e) {
      // ignore
    }
    setIsListening(false);

    if (!spokenPrompt) return;

    const listenAfterPrompt = () => {
      if (sequence !== promptSequenceRef.current) return;
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = setTimeout(() => {
        if (sequence === promptSequenceRef.current) void startListening();
      }, 250);
    };
    speak(spokenPrompt, currentLang, { onDone: listenAfterPrompt });
  }, [currentLang, spokenPrompt, startListening]);

  // Trigger prompt when step changes
  useEffect(() => {
    let tId: any = null;
    if (step <= 3) {
      tId = setTimeout(() => {
        playPromptAndListen(step);
      }, 50);
    }
    return () => {
      ++promptSequenceRef.current;
      clearTimeout(tId);
      clearTimeout(speechTimerRef.current);
      stopSpeaking();
      try {
        sttService.stopListening();
      } catch (_e) {
        // ignore
      }
    };
  }, [step, playPromptAndListen]);

  // Manual Next Button click
  const handleNextStep = () => {
    stopListening();
    stopSpeaking();
    setError('');

    const currentVal = questions[step]?.value?.trim() || '';
    if (!currentVal) {
      setError(currentLang === 'hi' ? 'कृपया जानकारी बोलें या लिखें' : 'Please speak or enter an answer');
      return;
    }

    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleFinalSubmit = useCallback(async () => {
    clearTimeout(finishTimerRef.current);
    setIsSaving(true);
    try {
      await saveTouchlessProfile({
        name: name.trim(),
        place: place.trim(),
        occupation: occupation.trim(),
        age: age.trim(),
      });
    } catch (e) {
      console.warn('Failed to save profile', e);
      setIsSaving(false);
    }
  }, [name, place, occupation, age]);

  // Complete onboarding on Step 4
  useEffect(() => {
    let tId: any = null;
    if (step === 4) {
      tId = setTimeout(() => {
        stopListening();
        const finalName = name || 'Friend';
        const welcomePhrase = currentLang === 'hi'
          ? `स्वागत है ${finalName} जी! आपका आर्थिक खाता तैयार है।`
          : `Welcome ${finalName}! Your Aarthika profile is ready.`;
        speak(welcomePhrase, currentLang, {
          onDone: () => { void handleFinalSubmit(); },
        });
      }, 50);
    }
    return () => {
      clearTimeout(tId);
      clearTimeout(finishTimerRef.current);
    };
  }, [step, name, currentLang, stopListening, handleFinalSubmit]);

  // Quick restore previous profile — no fake defaults (Section J)
  const handleQuickRestore = async (prof: any) => {
    stopSpeaking();
    stopListening();
    setIsSaving(true);
    await saveTouchlessProfile({
      name: (prof.name || prof.fullName || '').trim(),
      place: (prof.place || prof.village || prof.district || '').trim(),
      occupation: (prof.occupation || '').trim(),
      age: prof.age ? String(prof.age).trim() : '',
      isGuest: !!prof.isGuest,
    });
  };

  const currentQ = questions[step];

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { minHeight: '100%', justifyContent: 'center' }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.touchlessHeader}>
        <View style={styles.touchlessBadge}>
          <View style={styles.touchlessBadgeDot} />
          <Text style={styles.touchlessBadgeText}>
            {currentLang === 'hi' ? 'स्पर्श-मुक्त आवाज़ ऑनबोर्डिंग' : '🎙️ Touchless Voice Onboarding'}
          </Text>
        </View>
        <Text style={styles.touchlessTitle}>
          {currentLang === 'hi' ? 'बोलकर खाता बनाएं' : 'Speak to Get Started'}
        </Text>
        <Text style={styles.touchlessSubtitle}>
          {currentLang === 'hi'
            ? 'बस स्वाभाविक आवाज़ में जवाब दें — टाइप करने की ज़रूरत नहीं'
            : 'Just speak naturally — no passwords or complicated typing needed'}
        </Text>
      </View>

      {/* Quick Restore Pill for Previous User */}
      {storedProfile && step === 0 && (
        <TouchableOpacity
          style={styles.touchlessStoredCard}
          onPress={() => handleQuickRestore(storedProfile)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.secondary }}>
              {currentLang === 'hi' ? 'पिछला सहेजा हुआ प्रोफ़ाइल' : 'PREVIOUS SAVED PROFILE'}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.onSurface, marginTop: 2 }}>
              👤 {storedProfile.name}
              {storedProfile.place ? ` (${storedProfile.place})` : ''}
            </Text>
            {storedProfile.occupation ? (
              <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 1 }}>
                💼 {storedProfile.occupation}
              </Text>
            ) : null}
          </View>
          <View style={{ backgroundColor: COLORS.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
              {currentLang === 'hi' ? 'जारी रखें ➔' : 'Continue ➔'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Progress Dots (1. Name • 2. Place • 3. Occupation • 4. Age) */}
      <View style={styles.touchlessProgressRow}>
        {[0, 1, 2, 3].map((idx) => {
          const isDone = step > idx;
          const isActive = step === idx;
          return (
            <React.Fragment key={idx}>
              <View
                style={[
                  styles.touchlessStepDot,
                  isDone && styles.touchlessStepDotDone,
                  isActive && styles.touchlessStepDotActive,
                ]}
              >
                <Text
                  style={[
                    styles.touchlessStepDotText,
                    (isDone || isActive) && styles.touchlessStepDotTextActive,
                  ]}
                >
                  {isDone ? '✓' : idx + 1}
                </Text>
              </View>
              {idx < 3 && (
                <View
                  style={[
                    styles.touchlessProgressLine,
                    step > idx && styles.touchlessProgressLineDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Main Interactive Screen Content */}
      {step < 4 ? (
        <View style={styles.touchlessMicCard}>
          {/* Question Title & Subtext */}
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 36, marginBottom: 4 }}>{currentQ?.icon}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.onSurface, textAlign: 'center' }}>
              {currentQ?.title}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
              {currentQ?.prompt}
            </Text>
          </View>

          {/* Central Pulsing Microphone Visualizer */}
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
            {isListening && (
              <Animated.View
                style={[
                  styles.touchlessRipple,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.8],
                        }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.7, 0.3, 0],
                    }),
                  },
                ]}
              />
            )}

            <TouchableOpacity
              style={[
                styles.touchlessMicBtn,
                isListening && styles.touchlessMicBtnListening,
              ]}
              onPress={() => {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 36 }}>{isListening ? '🎙️' : '🎤'}</Text>
            </TouchableOpacity>
          </View>

          {/* Listening Status & Animated Wave Bars */}
          <Text style={styles.touchlessMicStatusText}>
            {isListening
              ? (currentLang === 'hi' ? 'आर्थिक सुन रहा है...' : 'Aarthika is listening...')
              : (currentLang === 'hi' ? 'बोलने के लिए माइक दबाएं' : 'Tap mic to speak')}
          </Text>

          {isListening && (
            <View style={styles.touchlessWaveRow}>
              <Animated.View style={[styles.touchlessWaveBar, { height: waveAnim1 }]} />
              <Animated.View style={[styles.touchlessWaveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.touchlessWaveBar, { height: waveAnim3 }]} />
              <Animated.View style={[styles.touchlessWaveBar, { height: waveAnim4 }]} />
            </View>
          )}

          {/* Real-time Live Transcript Bubble */}
          {liveTranscript ? (
            <View style={styles.touchlessLiveTranscriptPill}>
              <Text style={styles.touchlessLiveTranscriptText}>
                &ldquo;{liveTranscript}&rdquo;
              </Text>
            </View>
          ) : null}

          {/* Tactile / Manual Input Fallback */}
          <View style={{ width: '100%', marginTop: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, marginBottom: 4 }}>
              {currentLang === 'hi' ? 'या नीचे लिखें / सुधारें:' : 'Or edit / type below:'}
            </Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 0 }]}
              placeholder={currentQ?.placeholder}
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={currentQ?.value}
              onChangeText={(txt) => {
                currentQ?.setValue(txt);
                setError('');
              }}
              keyboardType={step === 3 ? 'numeric' : 'default'}
              returnKeyType={step === 3 ? 'done' : 'next'}
              onSubmitEditing={handleNextStep}
            />
          </View>

          {/* Quick suggestions for common places */}
          {step === 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%', marginTop: 8 }}>
              {['पुणे / Pune', 'वाराणसी / Varanasi', 'नासिक / Nashik', 'बारामती / Baramati', 'इंदौर / Indore'].map((plc) => (
                <TouchableOpacity
                  key={plc}
                  style={{
                    backgroundColor: '#e8f5e9',
                    borderColor: '#a5d6a7',
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 16,
                  }}
                  onPress={() => {
                    const cleanPlc = plc.split('/')[0].trim();
                    setPlace(cleanPlc);
                    setError('');
                    setStep(2);
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '600' }}>{plc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick suggestions for common occupations */}
          {step === 2 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%', marginTop: 8 }}>
              {['दूध डेयरी / Dairy', 'खेती / Farming', 'मुर्गी पालन / Poultry', 'किराना / Kirana', 'सिलाई / Tailoring'].map((occ) => (
                <TouchableOpacity
                  key={occ}
                  style={{
                    backgroundColor: '#e8f5e9',
                    borderColor: '#a5d6a7',
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 16,
                  }}
                  onPress={() => {
                    const cleanOcc = occ.split('/')[0].trim();
                    setOccupation(cleanOcc);
                    setError('');
                    setStep(3);
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '600' }}>{occ}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error ? (
            <View style={[styles.errorBox, { marginTop: 8 }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Navigation Controls */}
          <View style={{ flexDirection: 'row', width: '100%', marginTop: 16, gap: 10 }}>
            {step > 0 && (
              <TouchableOpacity
                style={[styles.outlineButton, { flex: 1, minHeight: 46 }]}
                onPress={() => {
                  stopListening();
                  stopSpeaking();
                  setStep(step - 1);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.outlineButtonText}>
                  {currentLang === 'hi' ? '← पीछे' : '← Back'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, { flex: step > 0 ? 2 : 1, marginTop: 0, minHeight: 46 }]}
              onPress={handleNextStep}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {step === 3
                  ? (currentLang === 'hi' ? 'पूरा करें ➔' : 'Complete ➔')
                  : (currentLang === 'hi' ? 'अगला कदम ➔' : 'Next Step ➔')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Step 4: Summary / Confirmation Screen */
        <View style={styles.card}>
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <Text style={{ fontSize: 44, marginBottom: 6 }}>🪷</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.primary, textAlign: 'center' }}>
              {currentLang === 'hi' ? '✨ खाता तैयार है!' : '✨ Profile Ready!'}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
              {currentLang === 'hi'
                ? `स्वागत है ${name || 'मित्र'} जी! आपका वित्तीय डैशबोर्ड तैयार है।`
                : `Welcome ${name || 'Friend'}! Setting up your business financial dashboard...`}
            </Text>
          </View>

          <View style={{ marginVertical: 10 }}>
            <View style={styles.touchlessSummaryItem}>
              <Text style={styles.touchlessSummaryLabel}>
                {currentLang === 'hi' ? '👤 नाम' : '👤 Name'}
              </Text>
              <Text style={styles.touchlessSummaryValue}>{name || 'Not provided'}</Text>
            </View>

            <View style={styles.touchlessSummaryItem}>
              <Text style={styles.touchlessSummaryLabel}>
                {currentLang === 'hi' ? '📍 स्थान' : '📍 Place'}
              </Text>
              <Text style={styles.touchlessSummaryValue}>{place || 'Not provided'}</Text>
            </View>

            <View style={styles.touchlessSummaryItem}>
              <Text style={styles.touchlessSummaryLabel}>
                {currentLang === 'hi' ? '💼 व्यवसाय' : '💼 Occupation'}
              </Text>
              <Text style={styles.touchlessSummaryValue}>{occupation || 'Not provided'}</Text>
            </View>

            <View style={[styles.touchlessSummaryItem, { borderBottomWidth: 0 }]}>
              <Text style={styles.touchlessSummaryLabel}>
                {currentLang === 'hi' ? '🎂 उम्र' : '🎂 Age'}
              </Text>
              <Text style={styles.touchlessSummaryValue}>
                {age ? `${age} ${currentLang === 'hi' ? 'वर्ष' : 'years'}` : 'Not provided'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleFinalSubmit}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? (currentLang === 'hi' ? 'खाता सहेजा जा रहा है...' : 'Saving Profile...')
                : (currentLang === 'hi' ? 'आर्थिक शुरू करें ➔' : 'Start Exploring Businesses ➔')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Guest / Skip Option */}
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <TouchableOpacity
          onPress={() => {
            stopSpeaking();
            stopListening();
            saveTouchlessProfile({
              isGuest: true,
              name: '',
              place: '',
              occupation: '',
              age: '',
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: COLORS.secondary, fontWeight: '700' }}>
            {currentLang === 'hi' ? 'अतिथि के रूप में जारी रखें →' : 'Skip & Explore as Guest →'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Aliases so existing routes never fail
const LoginScreen = TouchlessAuthScreen;
const SignupScreen = TouchlessAuthScreen;

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
  const voiceSequenceRef = useRef(0);
  const [pulseAnim] = useState(() => new Animated.Value(1));

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

  const startListening = useCallback(async () => {
    const sequence = voiceSequenceRef.current;
    await stopSpeaking();
    if (sequence !== voiceSequenceRef.current) return;
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
  }, [currentLang]);

  const promptText = t('home_question') || 'What business do you want to start or grow?';

  // Start the microphone only when the prompt is done.
  useEffect(() => {
    if (isOpen) {
      const sequence = ++voiceSequenceRef.current;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTranscript('');
      setVoiceError(null);
      if (!spokenRef.current) {
        spokenRef.current = true;
        speak(promptText, currentLang, {
          onDone: () => {
            if (sequence === voiceSequenceRef.current) void startListening();
          },
        });
      } else {
        void startListening();
      }
    } else {
      ++voiceSequenceRef.current;
      spokenRef.current = false;
      stopSpeaking();
      sttService.stopListening();
      setIsListening(false);
    }
    return () => {
      ++voiceSequenceRef.current;
      stopSpeaking();
      sttService.stopListening();
    };
  }, [isOpen, currentLang, promptText, startListening]);


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
              onPress={isListening ? () => { sttService.stopListening(); setIsListening(false); } : () => { void startListening(); }}
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
            &quot;{t('home_question') || 'What business do you want to start or grow?'}&quot;
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

  /* Touchless Auth Screen Styles */
  touchlessHeader: { alignItems: 'center', marginBottom: 12, marginTop: 4 },
  touchlessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 102, 83, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  touchlessBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginRight: 6,
  },
  touchlessBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  touchlessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: 4,
  },
  touchlessSubtitle: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  touchlessProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  touchlessStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchlessStepDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  touchlessStepDotDone: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  touchlessStepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  },
  touchlessStepDotTextActive: {
    color: '#ffffff',
  },
  touchlessProgressLine: {
    width: 20,
    height: 3,
    backgroundColor: COLORS.outlineVariant,
    marginHorizontal: 4,
    borderRadius: 1.5,
  },
  touchlessProgressLineDone: {
    backgroundColor: COLORS.secondary,
  },
  touchlessMicCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.4)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 14,
    position: 'relative',
    overflow: 'visible',
  },
  touchlessRipple: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(244, 162, 97, 0.35)',
  },
  touchlessMicBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  touchlessMicBtnListening: {
    backgroundColor: '#3f6653',
  },
  touchlessMicStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 12,
  },
  touchlessWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    marginTop: 6,
  },
  touchlessWaveBar: {
    width: 4,
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  touchlessLiveTranscriptPill: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
    maxWidth: '92%',
  },
  touchlessLiveTranscriptText: {
    fontSize: 13,
    color: COLORS.deepForest,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  touchlessSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 194, 181, 0.25)',
  },
  touchlessSummaryLabel: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  touchlessSummaryValue: {
    fontSize: 14,
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  touchlessStoredCard: {
    backgroundColor: COLORS.secondaryContainer,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

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
  langSelectorBadge: {},
  langSelectorBadgeText: {},
  centerSection: {},
});
