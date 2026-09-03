// @ts-nocheck
/**
 * AARTHIKA - Mobile Application (React Native / Expo)
 * "Clarity Before Credit"
 */

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { api } from '../services/api';
import { speak, stopSpeaking } from '../services/tts';
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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { GoNoGoGauge } from '../../components/GoNoGoGauge';
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

// ------------------------------------------------------------------
// i18n: AARTHIKA_TRANSLATIONS
// Attached to the global object so the `t()` helper (see AppContext)
// can look up per-language strings. All keys used by the app live here.
// ------------------------------------------------------------------
const AARTHIKA_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    tagline: 'Clarity Before Credit',
    greeting_prefix: 'Namaste',
    home_question: 'What business do you want to start or grow?',
    home_subtext: 'Just tell Aarthika — no need to type.',
    nav_home: 'Home',
    nav_my_plan: 'My Plan',
    nav_risk_test: 'Risk Test',
    nav_profile: 'Profile'
  },
  hi: {
    tagline: 'ऋण से पहले स्पष्टता',
    greeting_prefix: 'नमस्ते',
    home_question: 'आप कौन सा व्यवसाय शुरू या बढ़ाना चाहते हैं?',
    home_subtext: 'बस आरथिका को बताएं — टाइप करने की ज़रूरत नहीं।',
    nav_home: 'होम',
    nav_my_plan: 'मेरी योजना',
    nav_risk_test: 'जोखिम परीक्षण',
    nav_profile: 'प्रोफ़ाइल'
  },
  ml: {
    tagline: 'വായ്പയ്ക്ക് മുമ്പ് വ്യക്തത',
    greeting_prefix: 'നമസ്കാരം',
    home_question: 'ഏത് ബിസിനസ്സാണ് നിങ്ങൾ തുടങ്ങാനോ വളർത്താനോ ആഗ്രഹിക്കുന്നത്?',
    home_subtext: 'ആർത്തികയോട് പറയൂ — ടൈപ്പ് ചെയ്യേണ്ടതില്ല.',
    nav_home: 'ഹോം',
    nav_my_plan: 'എന്റെ പ്ലാൻ',
    nav_risk_test: 'റിസ്ക് ടെസ്റ്റ്',
    nav_profile: 'പ്രൊഫൈൽ'
  },
  te: {
    tagline: 'ఋణానికి ముందు స్పష్టత',
    greeting_prefix: 'నమస్తే',
    home_question: 'మీరు ఏ వ్యాపారాన్ని ప్రారంభించాలని లేదా పెంచాలని అనుకుంటున్నారు?',
    home_subtext: 'కేవలం ఆర్థికకు చెప్పండి — టైప్ చేయాల్సిన అవసరం లేదు.',
    nav_home: 'హోమ్',
    nav_my_plan: 'నా ప్లాన్',
    nav_risk_test: 'రిస్క్ టెస్ట్',
    nav_profile: 'ప్రొఫైల్'
  },
  pa: {
    tagline: 'ਕਰਜ਼ੇ ਤੋਂ ਪਹਿਲਾਂ ਸਪੱਸ਼ਟਤਾ',
    greeting_prefix: 'ਨਮਸਤੇ',
    home_question: 'ਤੁਸੀਂ ਕਿਹੜਾ ਕਾਰੋਬਾਰ ਸ਼ੁਰੂ ਕਰਨਾ ਜਾਂ ਵਧਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
    home_subtext: 'ਬੱਸ ਆਰਥਿਕਾ ਨੂੰ ਦੱਸੋ — ਟਾਈਪ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।',
    nav_home: 'ਹੋਮ',
    nav_my_plan: 'ਮੇਰੀ ਯੋਜਨਾ',
    nav_risk_test: 'ਜੋਖਮ ਟੈਸਟ',
    nav_profile: 'ਪ੍ਰੋਫਾਈਲ'
  },
  kn: {
    tagline: 'ಸಾಲಕ್ಕಿಂತ ಮೊದಲು ಸ್ಪಷ್ಟತೆ',
    greeting_prefix: 'ನಮಸ್ತೆ',
    home_question: 'ನೀವು ಯಾವ ವ್ಯಾಪಾರವನ್ನು ಪ್ರಾರಂಭಿಸಲು ಅಥವಾ ಬೆಳೆಸಲು ಬಯಸುತ್ತೀರಿ?',
    home_subtext: 'ಕೇವಲ ಆರ್ತಿಕಾಗೆ ಹೇಳಿ — ಟೈಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.',
    nav_home: 'ಹೋಮ್',
    nav_my_plan: 'ನನ್ನ ಯೋಜನೆ',
    nav_risk_test: 'ಅಪಾಯ ಪರೀಕ್ಷೆ',
    nav_profile: 'ಪ್ರೊಫೈಲ್'
  },
  ur: {
    tagline: 'قرض سے پہلے وضاحت',
    greeting_prefix: 'نمستے',
    home_question: 'آپ کون سا کاروبار شروع کرنا یا بڑھانا چاہتے ہیں؟',
    home_subtext: 'بس آرتھیکا کو بتائیں — ٹائپ کرنے کی ضرورت نہیں۔',
    nav_home: 'ہوم',
    nav_my_plan: 'میرا منصوبہ',
    nav_risk_test: 'رسک ٹیسٹ',
    nav_profile: 'پروفائل'
  },
  bho: {
    tagline: 'कर्जा से पहिले स्पष्टता',
    greeting_prefix: 'प्रणाम',
    home_question: 'रउआ केहन व्यापार शुरू करे चाहीं भा बढ़ावे चाहीं?',
    home_subtext: 'बस आरथिका से कहीं — टाइप करे के जरूरत नइखे।',
    nav_home: 'होम',
    nav_my_plan: 'हमार योजना',
    nav_risk_test: 'जोखिम परीक्षण',
    nav_profile: 'प्रोफाइल'
  }
};

// Make translations available to the `t()` lookup (RN native: `global`,
// web: `window`). This must run before any screen renders.
const _tGlobal: any = typeof window !== 'undefined' ? window : global;
_tGlobal.AARTHIKA_TRANSLATIONS = AARTHIKA_TRANSLATIONS;

// ------------------------------------------------------------------
// Shared helper: map the in-memory activeBusiness plan to the backend's
// BusinessAssumption schema so the exact user-entered inputs persist.
// ------------------------------------------------------------------
function buildAssumptionsPayload(biz: any, businessId: string): Record<string, unknown> {
  const setupCost = biz?.setupCost ?? 95000;
  const monthlyFixed = biz?.monthlyFixed ?? 4000;
  const pricePerUnit = biz?.pricePerUnit ?? 40;
  const costPerUnit = biz?.costPerUnit ?? 18;
  const salesPerMonth = biz?.salesPerMonth ?? 1800;
  const personalCost = biz?.personalCost ?? 8000;

  return {
    // business_id is REQUIRED by the backend's BusinessAssumptionCreate
    // schema (it's validated before the route can fill it in).
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
const SNAP_INTERVAL = CARD_WIDTH + 14;

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
  navActive: '#014737'
};

const AppContext = createContext({
  currentLang: 'en',
  setCurrentLang: () => {},
  currentScreen: 'signup',
  navigateTo: () => {},
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
    profileImage: null
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
    breakdown: []
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
  setIsLangModalOpen: () => {}
});
export const useApp = () => useContext(AppContext);

export default function App() {
  const [currentLang, setCurrentLang] = useState('en');
  const [currentScreen, setCurrentScreen] = useState('signup');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({
    fullName: '',
    firstName: '',
    lastName: '',
    mobile: '',
    age: '',
    state: 'Chhattisgarh',
    district: 'Raigarh',
    village: 'Dharamjaigarh',
    occupation: 'Farmer',
    interestedSector: 'Farming',
    hasExistingBusiness: 'No',
    profileImage: null
  });

  // Hydrate persisted user on startup
  useEffect(() => {
    (async () => {
      try {
        const userJson = await AsyncStorage.getItem('@user');
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
  }, []); // empty deps -> run once

  const [activeBusiness, setActiveBusiness] = useState({
    sector: 'Farming',
    title: 'Organic Vegetable Farming',
    setupCost: 95000,
    monthlyFixed: 4000,
    unitType: 'Kg',
    pricePerUnit: 40,
    costPerUnit: 18,
    salesPerMonth: 1800,
    personalCost: 8000,
    breakdown: [
      { label: 'Drip Irrigation & Land Prep', cost: 45000 },
      { label: 'Certified Seeds & Bio-Fertilizer', cost: 30000 },
      { label: 'Sprayer & Crates', cost: 20000 }
    ]
  });
  const [activeBusinessId, setActiveBusinessId] = useState(null);
  const [aiReport, setAiReport] = useState(null);

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const t = (key) => {
    const globalObj: any = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
    const dict = globalObj.AARTHIKA_TRANSLATIONS ? (globalObj.AARTHIKA_TRANSLATIONS[currentLang] || globalObj.AARTHIKA_TRANSLATIONS['en']) : null;
    if (dict && dict[key]) return dict[key];
    return key;
  };

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
  };

  const handleSignup = async (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setCurrentScreen('home');
    try {
      await AsyncStorage.setItem('@user', JSON.stringify(userData));
    } catch (e) {
      console.warn('Failed to persist user on signup', e);
    }
  };

  const handleLogin = async (mobile, password) => {
    const updated = (prev) => ({
      ...prev,
      mobile: mobile || prev.mobile || '9876543210',
      fullName: prev.fullName || 'Ramesh Kumar',
      firstName: prev.firstName || 'Ramesh'
    });
    setUser(updated);
    setIsAuthenticated(true);
    setCurrentScreen('home');
    try {
      const current = await AsyncStorage.getItem('@user');
      const merged = current ? JSON.parse(current) : {};
      await AsyncStorage.setItem('@user', JSON.stringify({...merged, ...updated({})}));
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
      profileImage: null
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
        setCurrentLang,
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
        setIsLangModalOpen
      }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'horizontal']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

        {/* Mobile Header with Official Logo */}
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
        </View>

        {/* Mobile Bottom Tab Navigation - separate SafeAreaView for bottom */}
        {isAuthenticated && currentScreen !== 'signup' && currentScreen !== 'login' && (
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.surfaceContainerLowest }}>
            <BottomTabBar currentScreen={currentScreen} onNavigate={navigateTo} t={t} />
          </SafeAreaView>
        )}

        {/* Language Selection Modal */}
        <LanguageModal
          isOpen={isLangModalOpen}
          onClose={() => setIsLangModalOpen(false)}
          currentLang={currentLang}
          onSelect={(lang) => {
            setCurrentLang(lang);
            setIsLangModalOpen(false);
          }}
        />

        {/* Voice Recognition Modal */}
        <VoiceModal
          isOpen={isVoiceActive}
          onClose={() => setIsVoiceActive(false)}
          t={t}
          currentLang={currentLang}
          onTranscript={(text: string) => {
            setActiveBusiness((prev) => ({ ...prev, title: text, sector: 'Custom' }));
            setIsVoiceActive(false);
            setCurrentScreen('business_details');
          }}
        />
      </SafeAreaView>
    </AppContext.Provider>
  );
}

// ----------------------------------------------------
// MOBILE HEADER COMPONENT WITH BLENDED LOGO
// ----------------------------------------------------
function MobileHeader() {
  const { currentLang, setIsLangModalOpen, navigateTo, isAuthenticated } = useApp();

  const langNames = {
    en: 'English',
    hi: 'हिन्दी',
    ml: 'മലയാളം',
    te: 'తెలుగు',
    pa: 'ਪੰਜਾਬੀ',
    kn: 'ಕನ್ನಡ',
    ur: 'اردو',
    bho: 'भोजपुरी'
  };

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.brandingContainer}
        onPress={() => (isAuthenticated ? navigateTo('home') : navigateTo('signup'))}
      >
        <Image
          source={APP_LOGO}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Pressable>

      <TouchableOpacity
        style={styles.langButton}
        onPress={() => setIsLangModalOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.langIcon}>🌐</Text>
        <Text style={styles.langButtonText}>{langNames[currentLang] || 'English'}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----------------------------------------------------
// BOTTOM TAB BAR COMPONENT
// ----------------------------------------------------
function BottomTabBar({ currentScreen, onNavigate, t }) {
  const tabs = [
    { key: 'home', label: t('nav_home') || 'Home', icon: '🏠' },
    { key: 'my_plan', label: t('nav_my_plan') || 'My Plan', icon: '📋' },
    { key: 'risk_test', label: t('nav_risk_test') || 'Risk Test', icon: '📊' },
    { key: 'profile', label: t('nav_profile') || 'Profile', icon: '👤' }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, isActive && styles.activeTabItem]}
            onPress={() => onNavigate(tab.key)}
            activeOpacity={0.7}
          >
            <View style={isActive ? styles.activeTabIconWrap : styles.tabIconWrap}>
              <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeTabDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ----------------------------------------------------
// SIGN UP SCREEN
// ----------------------------------------------------
function SignUpScreen() {
  const { handleSignup, navigateTo } = useApp();
  const [fullName, setFullName] = useState('Ramesh Kumar');
  const [mobile, setMobile] = useState('9876543210');
  const [age, setAge] = useState('28');
  const [state, setState] = useState('Chhattisgarh');
  const [district, setDistrict] = useState('Raigarh');
  const [village, setVillage] = useState('Dharamjaigarh');
  const [occupation, setOccupation] = useState('Farmer');
  const [interestedSector, setInterestedSector] = useState('Farming');
  const [password, setPassword] = useState('123456');

  const submit = () => {
    if (!fullName.trim() || !mobile.trim()) {
      Alert.alert('Required', 'Please enter your Full Name and Mobile Number.');
      return;
    }
    const nameParts = fullName.trim().split(' ');
    handleSignup({
      fullName: fullName.trim(),
      firstName: nameParts[0] || 'User',
      lastName: nameParts.slice(1).join(' ') || '',
      mobile: mobile.trim(),
      age: age.trim() || '28',
      state,
      district,
      village,
      occupation,
      hasExistingBusiness: 'No',
      interestedSector,
      password: password || '123456'
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.authHeader}>
          <Text style={styles.authTitle}>Create Your Account</Text>
          <Text style={styles.authSubtitle}>
            Join Aarthika to plan your business simply and securely.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={COLORS.outlineVariant}
          />

          <Text style={styles.inputLabel}>Mobile Number</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
            placeholderTextColor={COLORS.outlineVariant}
          />

          <Text style={styles.inputLabel}>Age / Date of Birth</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            placeholderTextColor={COLORS.outlineVariant}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput style={styles.textInput} value={state} onChangeText={setState} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>District</Text>
              <TextInput style={styles.textInput} value={district} onChangeText={setDistrict} />
            </View>
          </View>

          <Text style={styles.inputLabel}>Village / Town</Text>
          <TextInput style={styles.textInput} value={village} onChangeText={setVillage} />

          <Text style={styles.inputLabel}>Current Occupation</Text>
          <TextInput style={styles.textInput} value={occupation} onChangeText={setOccupation} />

          <Text style={styles.inputLabel}>Interested Business Sector</Text>
          <TextInput style={styles.textInput} value={interestedSector} onChangeText={setInterestedSector} />

          <Text style={styles.inputLabel}>Create Password</Text>
          <TextInput style={styles.textInput} secureTextEntry value={password} onChangeText={setPassword} />

          <TouchableOpacity style={styles.primaryButton} onPress={submit} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Create Account →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.switchAuthContainer}>
          <Text style={styles.switchAuthText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigateTo('login')}>
            <Text style={styles.switchAuthLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ----------------------------------------------------
// LOGIN SCREEN
// ----------------------------------------------------
function LoginScreen() {
  const { handleLogin, navigateTo } = useApp();
  const [mobile, setMobile] = useState('9876543210');
  const [password, setPassword] = useState('password123');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.authHeader}>
        <Image
          source={APP_LOGO}
          style={[styles.logoImage, { width: 160, height: 60, marginBottom: 8 }]}
          resizeMode="contain"
        />
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.authSubtitle}>
          Log in to manage your business with clarity.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Mobile Number</Text>
        <TextInput
          style={styles.textInput}
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={setMobile}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.textInput}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleLogin(mobile, password)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Log In →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => handleLogin('9876543210', 'demo')}
          activeOpacity={0.8}
        >
          <Text style={styles.demoButtonText}>Quick Demo Login</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.switchAuthContainer}>
        <Text style={styles.switchAuthText}>New to Aarthika? </Text>
        <TouchableOpacity onPress={() => navigateTo('signup')}>
          <Text style={styles.switchAuthLink}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------
// HOME SCREEN (CLARITY BEFORE CREDIT ABOVE -> NAMASTE BELOW)
// ----------------------------------------------------
function HomeScreen() {
  const { user, setIsVoiceActive, navigateTo, setActiveBusiness, t } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const [businessQuery, setBusinessQuery] = useState('');
  const carouselRef = useRef(null);

  const handleTextSubmit = () => {
    if (businessQuery.trim().length > 0) {
      setActiveBusiness((prev) => ({ ...prev, title: businessQuery, sector: 'Custom' }));
      navigateTo('business_details');
    }
  };

  // Exact 5-Item Carousel Order with Clean Visuals
  const carouselItems = [
    { key: 'Farming', type: 'sector', label: 'Farming', sub: '🌾 Organic Agriculture & Crops', image: SECTOR_IMAGES.farming },
    { key: 'Poultry', type: 'sector', label: 'Poultry', sub: '🐔 Broiler & Country Chicken', image: SECTOR_IMAGES.poultry },
    { key: 'Goat Farming', type: 'sector', label: 'Goat Farming', sub: '🐐 Goat Rearing & Livestock', image: SECTOR_IMAGES.goat },
    { key: 'Dairy', type: 'sector', label: 'Dairy', sub: '🐄 Dairy Cattle & Milk Production', image: SECTOR_IMAGES.dairy },
    { key: 'Explore', type: 'action', label: 'Explore All Sectors', sub: 'Kirana, Handicraft, Tailoring & More' }
  ];

  const handleCardPress = (item) => {
    if (item.type === 'action') {
      navigateTo('explore_sectors');
    } else {
      setActiveBusiness((prev) => ({ ...prev, sector: item.key, title: item.label }));
      navigateTo('business_details');
    }
  };

  const scrollToCard = (index) => {
    if (carouselRef.current && index >= 0 && index < carouselItems.length) {
      carouselRef.current.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
      setActiveIndex(index);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. HERO SECTION: CLARITY BEFORE CREDIT (ABOVE) -> NAMASTE (BELOW) */}
      <View style={styles.centerSection}>
        <View style={styles.taglineBadge}>
          <Text style={styles.heroTagline}>
            {(t('tagline') || 'Clarity Before Credit').toUpperCase()}
          </Text>
        </View>

        <Text style={styles.greetingTitle}>
          {t('greeting_prefix') || 'Namaste'}, {user.firstName || 'Ramesh'} 🙏
        </Text>

        <Text style={styles.homeQuestion}>
          {t('home_question') || 'What business do you want to start or grow?'} {t('home_subtext') || 'Just tell Aarthika — no need to type.'}
        </Text>
      </View>

      {/* 2. Text Input & Central Voice Button */}
      <View style={[styles.voiceButtonContainer, { paddingHorizontal: 20 }]}>
        <View style={{ flexDirection: 'row', width: '100%', marginBottom: 12 }}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: COLORS.surfaceContainerLowest, marginRight: 8, marginBottom: 0 }]}
            placeholder="Type your business idea here..."
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={businessQuery}
            onChangeText={setBusinessQuery}
            onSubmitEditing={handleTextSubmit}
          />
          <TouchableOpacity style={[styles.primaryButton, { paddingHorizontal: 20, marginTop: 0 }]} onPress={handleTextSubmit}>
            <Text style={styles.primaryButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.voiceCTAButton}
          onPress={() => setIsVoiceActive(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.voiceCTAIcon}>🎙</Text>
          <Text style={styles.voiceCTAText}>Speak to Aarthika</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Popular Sectors: Horizontal Swipeable Carousel with Arrow Controls */}
      <View style={{ marginTop: 20 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionHeading}>POPULAR SECTORS</Text>
          
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
              onPress={() => scrollToCard(Math.min(carouselItems.length - 1, activeIndex + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={carouselRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="center"
          decelerationRate="fast"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.carouselContainer}
          onScroll={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const idx = Math.min(carouselItems.length - 1, Math.max(0, Math.round(offsetX / SNAP_INTERVAL)));
            setActiveIndex(idx);
          }}
          scrollEventThrottle={16}
        >
          {carouselItems.map((item, index) => {
            if (item.type === 'action') {
              return (
                <TouchableOpacity
                  key="explore_action"
                  style={[styles.carouselCard, styles.actionCard]}
                  onPress={() => handleCardPress(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.actionIconCircle}>
                    <Text style={{ fontSize: 28 }}>➔</Text>
                  </View>
                  <Text style={styles.actionCardTitle}>Explore All Sectors</Text>
                  <Text style={styles.actionCardSub}>{item.sub}</Text>
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>View 12+ Categories →</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={item.key}
                style={styles.carouselCard}
                onPress={() => handleCardPress(item)}
                activeOpacity={0.75}
              >
                <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
                <Text style={styles.cardTitle}>{item.label}</Text>
                <Text style={styles.cardSub}>{item.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Pagination Dots (Clickable) */}
        <View style={styles.paginationDots}>
          {carouselItems.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollToCard(i)}
              style={[
                styles.dot,
                i === activeIndex && styles.activeDot
              ]}
            />
          ))}
        </View>
      </View>

      {/* Offline Status */}
      <View style={styles.offlinePill}>
        <View style={styles.offlineDot} />
        <Text style={styles.offlineText}>Offline data saved</Text>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------
// MY PLAN SCREEN
// ----------------------------------------------------
function MyPlanScreen() {
  const { activeBusiness, navigateTo, user, setActiveBusinessId } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Derive ALL figures from the business the user actually entered ----
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

  // Math engine
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
      // Create user if not exists or use a mock user ID
      // For demo, we'll use a hardcoded user ID that should exist, or create a business with a fake UUID
      // In a real app we'd link to the actual logged-in user
      const businessData = {
        user_id: "user_123",
        business_name: activeBusiness.title || "Organic Vegetable Farming",
        business_category: activeBusiness.sector || "Farming",
        description: JSON.stringify(activeBusiness),
        status: "DRAFT"
      };
      // Try to create the business, but if it fails (user constraint), we'll gracefully fallback
      try {
        const response = await api.business.createBusiness(businessData);
        if (response && response.id) {
          setActiveBusinessId(response.id);
          // Persist the exact inputs the user entered so the backend can
          // re-run calculations from them (business_assumptions table).
          try {
            await api.business.createAssumption(response.id, buildAssumptionsPayload(activeBusiness, response.id));
          } catch (assumptionErr) {
            console.warn("Failed to persist assumptions:", (assumptionErr as Error).message);
          }
        }
      } catch (e) {
        console.error("Failed to hit backend to create business:", (e as Error).message);
        Alert.alert("Backend Warning", "Could not connect to FastAPI Backend.\n" + (e as Error).message);
        // Continue to RiskTest anyway but it won't have a valid ID for RAG
        setActiveBusinessId(null);
      }

      navigateTo('risk_test');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save business plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>My Business Plan</Text>
        <Text style={styles.screenHeaderSub}>{activeBusiness.title || 'Farming'} - Phase 1</Text>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoLabel}>Setup Costs</Text>
        <Text style={styles.bentoValuePrimary}>{fmt(setupCost)}</Text>
        <Text style={styles.bentoSub}>Initial investment required</Text>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoLabel}>Monthly Expenses</Text>
        <Text style={styles.bentoValuePrimary}>{fmt(totalMonthlyExpenses)}</Text>
        <Text style={styles.bentoSub}>
          {fmt(monthlyVariableCost)} variable · {fmt(monthlyFixed + personalCost)} fixed + living
        </Text>
      </View>

      <View style={[styles.bentoCard, { backgroundColor: COLORS.secondaryContainer }]}>
        <Text style={[styles.bentoLabel, { color: COLORS.secondary }]}>Estimated Profit</Text>
        <Text style={[styles.bentoValueSecondary, { color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>
          {fmt(monthlyNetProfit)}
        </Text>
        <Text style={[styles.bentoSub, { color: COLORS.onSecondaryContainer }]}>Projected net per month</Text>
      </View>

      {/* Enriched math engine */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardSectionTitle}>Financial Math</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Monthly Revenue ({salesPerMonth} × {fmt(pricePerUnit)})</Text>
          <Text style={styles.breakdownValue}>{fmt(monthlyRevenue)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Variable Cost ({salesPerMonth} × {fmt(costPerUnit)})</Text>
          <Text style={styles.breakdownValue}>−{fmt(monthlyVariableCost)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Gross Profit (margin {grossMarginPct.toFixed(1)}%)</Text>
          <Text style={[styles.breakdownValue, { color: COLORS.secondary }]}>{fmt(monthlyGrossProfit)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Fixed + Living Costs</Text>
          <Text style={styles.breakdownValue}>−{fmt(monthlyFixed + personalCost)}</Text>
        </View>
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 4, paddingTop: 8 }]}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>Net Monthly Profit ({netMarginPct.toFixed(0)}% margin)</Text>
          <Text style={[styles.breakdownValue, { fontWeight: '800', color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(monthlyNetProfit)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Break-even Revenue / Month</Text>
          <Text style={styles.breakdownValue}>{fmt(breakEvenRevenue)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Safety Margin ({safetyMarginPct.toFixed(0)}% cushion)</Text>
          <Text style={[styles.breakdownValue, { color: safetyMargin >= 0 ? COLORS.secondary : COLORS.error }]}>
            {fmt(safetyMargin)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Projected ROI (annualized)</Text>
          <Text style={styles.breakdownValue}>{roiPct.toFixed(1)}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Payback Period</Text>
          <Text style={styles.breakdownValue}>{paybackMonths ? `${paybackMonths} months` : 'N/A'}</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardSectionTitle}>Plan Breakdown</Text>
        {breakdown.map((item, i) => (
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
            <Text style={styles.outlineButtonText}>Edit Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, marginLeft: 8, marginTop: 0 }]}
            onPress={handleRunRiskTest}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Wait...' : 'View Risk →'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------
// RISK TEST SCREEN
// ----------------------------------------------------
function RiskTestScreen() {
  const { navigateTo, activeBusinessId, setActiveBusinessId, activeBusiness, user, aiReport, setAiReport, currentLang } = useApp();
  const [loading, setLoading] = useState(!aiReport);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Speak the AI verdict out loud (TTS) — text, not typed.
  const handleHearSummary = () => {
    const d = (dashboardData || dashboardView)?.recommendation;
    if (!d) return;
    const summary = `${d.decision || ''}. ${d.rationale || 'Analysis complete.'} ` +
      `Confidence ${Math.round((aiReport?.confidence || 0.85) * 100)} percent.`;
    speak(summary, currentLang);
  };

  // Guards against firing duplicate report requests (the [activeBusinessId]
  // effect re-runs when the auto-create path fills in the business id).
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    // A cached report for THIS business is rebuilt automatically at render
    // time (see dashboardView below), so nothing to do here. Only generate
    // when we don't yet have a report for the current business.
    if (aiReport && aiReport.business_id === activeBusinessId) return;
    if (isGeneratingRef.current) return;
    generateReport();
  }, [activeBusinessId]);

  const generateReport = async () => {
    isGeneratingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let bizId = activeBusinessId;

      // Auto-create business if not yet created (e.g., user tapped Risk Test tab directly)
      if (!bizId) {
        try {
          const businessData = {
            user_id: "user_123",
            business_name: activeBusiness?.title || "Organic Vegetable Farming",
            business_category: activeBusiness?.sector || "Farming",
            description: JSON.stringify(activeBusiness || {}),
            status: "DRAFT"
          };
          const created = await api.business.createBusiness(businessData);
          if (created?.id) {
            bizId = created.id;
            // NOTE: activeBusinessId is stored on the SUCCESS path below.
            // Setting it here would re-trigger the [activeBusinessId] effect
            // mid-generation and fire a second report request.
            // Persist the user's current inputs as the assumption set too
            try {
              await api.business.createAssumption(created.id, buildAssumptionsPayload(activeBusiness || {}, created.id));
            } catch (assumptionErr) {
              console.warn('Persist assumptions on auto-create failed:', (assumptionErr as Error).message);
            }
          }
        } catch (createErr) {
          console.warn('Auto-create business failed:', (createErr as Error).message);
        }
      }

      if (!bizId) {
        throw new Error("Business ID not found - backend may be unreachable. Ensure your FastAPI server is running.");
      }

      console.log('Generating AI report for business:', bizId);
      const report = await api.aiReports.generateReport(bizId);
      setAiReport(report);
      // Persist the resolved business id (matters when the Risk Test tab was
      // opened directly and the business was auto-created above). Doing this
      // on success keeps the [activeBusinessId] effect from re-firing while a
      // report is already in flight.
      if (typeof setActiveBusinessId === 'function') {
        setActiveBusinessId(bizId);
      }

      // Transform backend response to dashboard format
      const dashboardFormat = transformReportToDashboard(report, activeBusiness);
      setDashboardData(dashboardFormat);
    } catch (e) {
      console.error('LIVE RAG API ERROR:', (e as Error).message);
      Alert.alert(
        "RAG Backend Error",
        "Failed to generate AI report from 127.0.0.1:8000.\n\nReason: " + (e as Error).message + "\n\nPlease make sure your Python FastAPI backend is running and GROQ_API_KEY is active.\n\nShowing Mock Data for now.",
        [{ text: "OK" }]
      );

      // Fallback Demo Report only after alerting the user that RAG failed
      const fallbackReport = {
        decision: "GO",
        rationale: "MOCK/FALLBACK: " + (e as Error).message,
        confidence: 0.85,
        market_analysis: {
          demand_level: "HIGH",
          swot_strengths: ["High margin", "Local demand"],
          swot_weaknesses: ["Weather dependent"]
        },
        risk_assessment: {
          overall_risk: 0.35,
          top_risks: ["Seasonal variation", "Pest attacks"],
          safer_loan: 60000
        },
        modifications: ["Consider multi-cropping"],
        next_steps: ["Procure bio-fertilizer", "Set up drip irrigation"]
      };

      const dashboardFormat = transformReportToDashboard(fallbackReport, activeBusiness);
      setDashboardData(dashboardFormat);
    } finally {
      setLoading(false);
      isGeneratingRef.current = false;
    }
  };

  // Transform backend report to dashboard format
  const transformReportToDashboard = (report: any, business: any): any => {
    // Extract financials from business or use defaults
    const setupCost = business?.setupCost || 95000;
    const monthlyFixed = business?.monthlyFixed || 4000;
    const pricePerUnit = business?.pricePerUnit || 40;
    const costPerUnit = business?.costPerUnit || 18;
    const salesPerMonth = business?.salesPerMonth || 1800;
    const personalCost = business?.personalCost || 8000;

    const monthlyRevenue = salesPerMonth * pricePerUnit;
    const monthlyVariableCost = salesPerMonth * costPerUnit;
    const monthlyGrossProfit = monthlyRevenue - monthlyVariableCost;
    const monthlyNetProfit = monthlyGrossProfit - monthlyFixed - personalCost;

    // Calculate break-even revenue
    const breakEvenRevenue = monthlyFixed + personalCost + monthlyVariableCost;
    const safetyMargin = monthlyRevenue - breakEvenRevenue;

    // Calculate loan EMI (assuming 50% of setup cost as loan, 12% annual interest, 24 months)
    const loanAmount = setupCost * 0.5;
    const monthlyInterestRate = 0.12 / 12;
    const loanEMI = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, 24)) / (Math.pow(1 + monthlyInterestRate, 24) - 1) || 0;

    // Map decision
    const decisionMap: any = {
      GO: 'GO',
      MODIFY: 'CAUTION',
      DO_NOT_INVEST_YET: 'NO-GO'
    };

    // Process risks from risk_assessment
    const risks = [];
    if (report.risk_assessment?.top_risks) {
      report.risk_assessment.top_risks.forEach((riskName: string, index: number) => {
        // Use overall risk score as base, adjust per risk
        const baseRisk = report.risk_assessment.overall_risk || 0.35;
        const riskVariation = (index % 3) * 0.1; // 0, 0.1, 0.2
        const probability = Math.min(0.9, baseRisk + riskVariation);

        risks.push({
          risk: riskName,
          category: index % 3 === 0 ? 'Market' : index % 3 === 1 ? 'Operational' : 'Financial',
          probability: probability,
          impact: probability > 0.7 ? 'High' : probability > 0.4 ? 'Medium' : 'Low',
          severity: probability > 0.7 ? 'High' : probability > 0.4 ? 'Medium' : 'Low',
          financialExposure: Math.floor(monthlyRevenue * 0.1 * (index + 1)),
          mitigation: report.risk_assessment?.mitigation_strategies?.[index] || `Monitor and manage ${riskName.toLowerCase()} risk`
        });
      });
    }

    // If no risks from backend, create some default ones based on business type
    if (risks.length === 0) {
      const defaultRisks = [
        {
          risk: 'Market demand fluctuation',
          category: 'Market',
          probability: 0.4,
          impact: 'Medium',
          severity: 'Medium',
          financialExposure: Math.floor(monthlyRevenue * 0.15),
          mitigation: 'Conduct market validation before full launch'
        },
        {
          risk: 'Operational cost increase',
          category: 'Operational',
          probability: 0.3,
          impact: 'Medium',
          severity: 'Medium',
          financialExposure: Math.floor(monthlyRevenue * 0.1),
          mitigation: 'Lock in supplier prices with contracts'
        },
        {
          risk: 'Regulatory compliance',
          category: 'Regulatory',
          probability: 0.2,
          impact: 'Low',
          severity: 'Low',
          financialExposure: Math.floor(monthlyRevenue * 0.05),
          mitigation: 'Ensure all licenses and permits are up to date'
        }
      ];
      risks.push(...defaultRisks);
    }

    // Process SWOT
    const swot = {
      strengths: (report.market_analysis?.swot_strengths || []).map((strength: string, index: number) => ({
        finding: strength,
        whyItMatters: `Provides competitive advantage in ${business?.sector || 'market'} `,
        impact: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Low',
        evidence: `Based on market analysis of ${business?.sector || 'sector'} in ${business?.location || 'target area'}`
      })),
      weaknesses: (report.market_analysis?.swot_weaknesses || []).map((weakness: string, index: number) => ({
        finding: weakness,
        whyItMatters: `Could impact profitability and growth`,
        impact: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Low',
        evidence: `Identified through competitive analysis`
      })),
      opportunities: (report.market_analysis?.swot_opportunities || []).map((opportunity: string, index: number) => ({
        finding: opportunity,
        whyItMatters: `Represents potential growth avenue`,
        impact: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Low',
        evidence: `Market trend analysis suggests growing demand`
      })),
      threats: (report.market_analysis?.swot_threats || []).map((threat: string, index: number) => ({
        finding: threat,
        whyItMatters: `External factor that could negatively impact business`,
        impact: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Low',
        evidence: `Environmental and market scanning`
      }))
    };

    // Create financial scenarios
    const scenarios = [
      {
        name: 'Baseline',
        revenueChange: 0,
        costChange: 0,
        monthlyRevenue: monthlyRevenue,
        monthlyExpenses: monthlyVariableCost + monthlyFixed,
        loanEMI: loanEMI,
        netCashFlow: monthlyNetProfit
      },
      {
        name: 'Mild Stress',
        revenueChange: -10,
        costChange: 10,
        monthlyRevenue: monthlyRevenue * 0.9,
        monthlyExpenses: (monthlyVariableCost + monthlyFixed) * 1.1,
        loanEMI: loanEMI,
        netCashFlow: (monthlyRevenue * 0.9) - ((monthlyVariableCost + monthlyFixed) * 1.1) - loanEMI
      },
      {
        name: 'Moderate Stress',
        revenueChange: -20,
        costChange: 20,
        monthlyRevenue: monthlyRevenue * 0.8,
        monthlyExpenses: (monthlyVariableCost + monthlyFixed) * 1.2,
        loanEMI: loanEMI,
        netCashFlow: (monthlyRevenue * 0.8) - ((monthlyVariableCost + monthlyFixed) * 1.2) - loanEMI
      },
      {
        name: 'Severe Stress',
        revenueChange: -30,
        costChange: 30,
        monthlyRevenue: monthlyRevenue * 0.7,
        monthlyExpenses: (monthlyVariableCost + monthlyFixed) * 1.3,
        loanEMI: loanEMI,
        netCashFlow: (monthlyRevenue * 0.7) - ((monthlyVariableCost + monthlyFixed) * 1.3) - loanEMI
      }
    ];

    // Risk level determination
    const getRiskLevel = (score: number) => {
      if (score >= 0.8) return 'Critical';
      if (score >= 0.6) return 'High';
      if (score >= 0.4) return 'Moderate';
      return 'Low';
    };

    return {
      overallRiskScore: report.risk_assessment?.overall_risk || 0.35,
      businessViabilityScore: report.confidence || 0.85,
      financialResilience: Math.min(0.9, Math.max(0.1, monthlyNetProfit / monthlyRevenue || 0.1)),
      marketRisk: report.risk_assessment?.market_risk || 0.3,
      operationalRisk: report.risk_assessment?.operational_risk || 0.35,
      swot: swot,
      risks: risks,
      financials: {
        monthlyRevenue: monthlyRevenue,
        monthlyExpenses: monthlyVariableCost + monthlyFixed,
        loanEMI: loanEMI,
        netCashFlow: monthlyNetProfit,
        breakEvenRevenue: breakEvenRevenue,
        safetyMargin: safetyMargin
      },
      baseInputs: {
        pricePerUnit: pricePerUnit,
        costPerUnit: costPerUnit,
        salesPerMonth: salesPerMonth,
        monthlyFixed: monthlyFixed,
        personalCost: personalCost,
        setupCost: setupCost,
        loanAmount: loanAmount,
        interestRatePercent: 12,
        loanTenureMonths: 24
      },
      scenarios: scenarios,
      recommendation: {
        decision: decisionMap[report.decision] || 'CAUTION',
        rationale: report.rationale || 'Analysis completed based on available data',
        supportingPoints: [
          `Business viability score: ${Math.round((report.confidence || 0.85) * 100)}/100`,
          `Financial resilience: ${Math.min(0.9, Math.max(0.1, monthlyNetProfit / monthlyRevenue || 0.1)) * 100}%`,
          `Overall risk level: ${getRiskLevel(report.risk_assessment?.overall_risk || 0.35)}`
        ],
        actionItems: report.next_steps || ['Review detailed analysis', 'Consider risk mitigation strategies', 'Validate assumptions with experts']
      }
    };
  };

  // dashboardData is local state and resets to null whenever this screen
  // remounts (navigation away + back), but aiReport lives in context and
  // survives. Derive the view-model from the cached report so the dashboard
  // always renders after a remount, without a second API call.
  const dashboardView =
    dashboardData ||
    (aiReport && aiReport.business_id === activeBusinessId
      ? transformReportToDashboard(aiReport, activeBusiness)
      : null);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>Reality Check & Risk</Text>
        <Text style={styles.screenHeaderSub}>Multi-Agent AI Analysis</Text>
      </View>

      {!loading && dashboardView && (
        <TouchableOpacity
          style={[styles.demoButton, { marginHorizontal: 20, marginBottom: 4 }]}
          onPress={handleHearSummary}
          activeOpacity={0.8}
        >
          <Text style={[styles.demoButtonText, { color: COLORS.secondary }]}>🔊 Hear the AI Verdict</Text>
        </TouchableOpacity>
      )}

      {loading && !dashboardView ? (
        <View style={[styles.card, { padding: 30, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🤖</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' }}>
            Aarthika AI is analyzing your business...
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 10, textAlign: 'center' }}>
            (Context Retrieval → Market Analyst → Risk Actuary → Final Decision)
          </Text>
        </View>
      ) : (
        <RiskAnalysisDashboard riskData={dashboardView} />
      )}
    </ScrollView>
  );
}

// ----------------------------------------------------
// PROFILE SCREEN

// ----------------------------------------------------
function ProfileScreen() {
  const { user, handleLogout } = useApp();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatarCircle}>
          <Text style={{ fontSize: 36 }}>👤</Text>
        </View>
        <Text style={styles.profileName}>{user.fullName || 'Ramesh Kumar'}</Text>
        <Text style={styles.profileLocation}>{user.district || 'Raigarh'}, {user.state || 'Chhattisgarh'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Profile Information</Text>
        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>Mobile Number</Text>
          <Text style={styles.profileInfoValue}>{user.mobile || '9876543210'}</Text>
        </View>
        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>Occupation</Text>
          <Text style={styles.profileInfoValue}>{user.occupation || 'Farmer'}</Text>
        </View>
        <View style={styles.profileInfoItem}>
          <Text style={styles.profileInfoLabel}>Interested Business</Text>
          <Text style={styles.profileInfoValue}>{user.interestedSector || 'Farming'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BusinessDetailsScreen() {
  const { activeBusiness, setActiveBusiness, navigateTo } = useApp();

  const [setupCost, setSetupCost] = useState((activeBusiness?.setupCost || 95000).toString());
  const [monthlyFixed, setMonthlyFixed] = useState((activeBusiness?.monthlyFixed || 5000).toString());
  const [pricePerUnit, setPricePerUnit] = useState((activeBusiness?.pricePerUnit || 100).toString());
  const [costPerUnit, setCostPerUnit] = useState((activeBusiness?.costPerUnit || 60).toString());
  const [salesPerMonth, setSalesPerMonth] = useState((activeBusiness?.salesPerMonth || 1000).toString());
  const [personalCost, setPersonalCost] = useState((activeBusiness?.personalCost || 10000).toString());
  const [disasterImpact, setDisasterImpact] = useState(0);
  const [isDraggingDisaster, setIsDraggingDisaster] = useState(false);

  const numSetup = parseFloat(setupCost) || 0;
  const numFixed = parseFloat(monthlyFixed) || 0;
  const numPrice = parseFloat(pricePerUnit) || 0;
  const numCost = parseFloat(costPerUnit) || 0;
  const numSales = parseFloat(salesPerMonth) || 0;
  const numPersonal = parseFloat(personalCost) || 0;

  const monthlyRevenue = numSales * numPrice;
  const monthlyVariableCost = numSales * numCost;
  
  // Incorporate disaster impact into costs (simulating disaster reducing revenue and increasing costs)
  const disasterFactor = 1 + disasterImpact;
  
  const monthlyGrossProfit = (monthlyRevenue * (1 - disasterImpact * 0.5)) - (monthlyVariableCost * disasterFactor);
  const monthlyNetProfit = monthlyGrossProfit - numFixed - numPersonal;
  
  // Calculate risk ratio for GoNoGoGauge based on net profit margin and disaster impact
  const profitMargin = monthlyRevenue > 0 ? (monthlyNetProfit / monthlyRevenue) : 0;
  let riskRatio = 0.5; // default medium risk
  if (profitMargin > 0.2) riskRatio = 0.2 + disasterImpact * 0.3; // Low risk, scales slightly with disaster
  else if (profitMargin > 0.05) riskRatio = 0.5 + disasterImpact * 0.4; // Med risk
  else riskRatio = 0.8 + disasterImpact * 0.2; // High risk

  const roiMonths = numSetup > 0 && monthlyNetProfit > 0 ? Math.round(numSetup / monthlyNetProfit) : 'N/A';

  // Save changes when running risk test
  const handleRunRiskTest = () => {
    setActiveBusiness(prev => ({
        ...prev,
        setupCost: numSetup,
        monthlyFixed: numFixed,
        pricePerUnit: numPrice,
        costPerUnit: numCost,
        salesPerMonth: numSales,
        personalCost: numPersonal
    }));
    navigateTo('my_plan');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>Business Financials</Text>
        <Text style={styles.screenHeaderSub}>{activeBusiness?.title || 'Farming'} - Edit Details</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Interactive Disaster Slider</Text>
        <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, marginBottom: 10 }}>
          Simulate drought, pests, or market crashes to see how resilient your business is.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Impact Severity:</Text>
            <Text style={{ fontWeight: 'bold', color: disasterImpact > 0.5 ? COLORS.error : COLORS.secondary }}>
                {(disasterImpact * 100).toFixed(0)}%
            </Text>
        </View>
        <Slider
            value={disasterImpact}
            onValueChange={setDisasterImpact}
            onSlidingStart={() => setIsDraggingDisaster(true)}
            onSlidingComplete={(v) => { setDisasterImpact(v); setIsDraggingDisaster(false); }}
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

      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Setup Costs (₹)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Initial Investment</Text>
          <TextInput 
             style={styles.input} 
             keyboardType="numeric" 
             value={setupCost} 
             onChangeText={setSetupCost} 
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Monthly Economics</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Sales/Month</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={salesPerMonth} onChangeText={setSalesPerMonth} />
            </View>
            <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Unit Price (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={pricePerUnit} onChangeText={setPricePerUnit} />
            </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Unit Cost (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={costPerUnit} onChangeText={setCostPerUnit} />
            </View>
            <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Fixed Costs (₹)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={monthlyFixed} onChangeText={setMonthlyFixed} />
            </View>
        </View>
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Personal Living Cost (₹)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={personalCost} onChangeText={setPersonalCost} />
        </View>
        
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant, marginTop: 10, paddingTop: 10 }]}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800' }]}>Projected Net Profit</Text>
          <Text style={[styles.breakdownValue, { fontWeight: '800', color: monthlyNetProfit >= 0 ? COLORS.secondary : COLORS.error }]}>₹{monthlyNetProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.outlineButton, { flex: 1, marginRight: 8 }]}
          onPress={() => navigateTo('home')}
        >
          <Text style={styles.outlineButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { flex: 1, marginLeft: 8 }]}
          onPress={handleRunRiskTest}
        >
          <Text style={styles.primaryButtonText}>Save & View Plan</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ExploreSectorsScreen() {
  const { navigateTo } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.screenHeaderTitle}>Explore Business Sectors</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigateTo('home')}>
        <Text style={styles.primaryButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ----------------------------------------------------
// MODALS
// ----------------------------------------------------
function LanguageModal({ isOpen, onClose, currentLang, onSelect }) {
  const langs = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'ml', label: 'മലയാളം (Malayalam)' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ur', label: 'اردو (Urdu)' },
    { code: 'bho', label: 'भोजपुरी (Bhojpuri)' }
  ];

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Select Language</Text>
          {langs.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langOption, currentLang === l.code && styles.activeLangOption]}
              onPress={() => onSelect(l.code)}
            >
              <Text style={styles.langOptionText}>{l.label}</Text>
              {currentLang === l.code && <Text style={{ color: COLORS.secondary }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function VoiceModal({ isOpen, onClose, t, currentLang, onTranscript }) {
  const [transcript, setTranscript] = useState('');
  const spokenRef = useRef(false);

  // Speak a greeting/prompt every time the modal opens (TTS).
  useEffect(() => {
    if (isOpen && !spokenRef.current) {
      spokenRef.current = true;
      const prompt = (t('home_question') || 'What business do you want to start or grow?');
      setTimeout(() => speak(prompt, currentLang), 350);
    }
    if (!isOpen) {
      spokenRef.current = false;
      stopSpeaking();
    }
  }, [isOpen, currentLang, t]);

  const handleSubmit = () => {
    const text = transcript.trim();
    if (!text) return;
    stopSpeaking();
    onTranscript(text);
    setTranscript('');
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.voiceModalCard}>
          <Text style={{ fontSize: 44 }}>🎙️</Text>
          <Text style={styles.voiceTitle}>Listening to you...</Text>
          <Text style={styles.voicePrompt}>"{t('home_question') || 'What business do you want to start or grow?'}"</Text>

          <TextInput
            style={[styles.textInput, { alignSelf: 'stretch', marginTop: 12 }]}
            placeholder="Type or dictate your business idea..."
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
            <Text style={styles.primaryButtonText}>Create Business from Voice</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.stopVoiceButton, { marginRight: 8 }]}
              onPress={() => speak((t('home_question') || 'What business do you want to start or grow?'), currentLang)}
            >
              <Text style={styles.stopVoiceText}>🔊 Hear Prompt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopVoiceButton} onPress={onClose}>
              <Text style={styles.stopVoiceText}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------
// MOBILE STYLESHEET
// ----------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 194, 181, 0.25)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoImage: {
    width: 140,
    height: 44
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  langIcon: { fontSize: 13, marginRight: 4 },
  langButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dropdownArrow: { fontSize: 8, color: COLORS.primary, marginLeft: 4 },

  screenContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 90 },

  authHeader: { alignItems: 'center', marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  authSubtitle: { fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.3)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 8,
    marginBottom: 4
  },
  input: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.onSurface,
    marginBottom: 10
  },
  inputContainer: {
    marginBottom: 8
  },
  textInput: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.onSurface
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  primaryButton: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onPrimaryContainer
  },

  demoButton: {
    backgroundColor: COLORS.secondaryContainer,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary
  },

  outlineButton: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  outlineButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  switchAuthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16
  },
  switchAuthText: { fontSize: 13, color: COLORS.onSurfaceVariant },
  switchAuthLink: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },

  centerSection: { alignItems: 'center', marginVertical: 10 },
  taglineBadge: {
    backgroundColor: COLORS.deepForest,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 12,
    elevation: 3,
    shadowColor: COLORS.deepForest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  heroTagline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center'
  },
  greetingTitle: { fontSize: 20, fontWeight: '700', color: COLORS.onSurface, marginBottom: 4 },
  homeQuestion: { fontSize: 13, fontWeight: '500', color: COLORS.secondary, textAlign: 'center', maxWidth: 300, lineHeight: 19 },

  voiceButtonContainer: { alignItems: 'center', marginVertical: 8 },
  voiceCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 3
  },
  voiceCTAIcon: { fontSize: 18, marginRight: 8, color: '#fff' },
  voiceCTAText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  sectionHeading: { fontSize: 12, fontWeight: '800', color: COLORS.onSurfaceVariant, letterSpacing: 0.5 },
  arrowButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center'
  },
  arrowButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginTop: -2
  },

  carouselContainer: {
    paddingVertical: 8,
    gap: 12
  },
  carouselCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(216, 194, 181, 0.35)',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2
  },
  cardImage: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface
  },
  cardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: 2
  },

  actionCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(142, 78, 20, 0.35)',
    justifyContent: 'center',
    minHeight: 220
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary
  },
  actionCardSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8
  },
  actionBadge: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  actionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },

  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(216, 194, 181, 0.7)'
  },
  activeDot: {
    width: 18,
    backgroundColor: COLORS.secondary
  },

  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 12
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
    marginBottom: 10
  },
  bentoLabel: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  bentoValuePrimary: { fontSize: 24, fontWeight: '700', color: COLORS.primary, marginVertical: 3 },
  bentoValueSecondary: { fontSize: 24, fontWeight: '700', color: COLORS.secondary, marginVertical: 3 },
  bentoSub: { fontSize: 11, color: COLORS.onSurfaceVariant },

  cardSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  breakdownLabel: { fontSize: 13, color: COLORS.onSurface },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },

  riskBadgeLow: { backgroundColor: COLORS.secondaryContainer, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  riskBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  adviceBox: { backgroundColor: 'rgba(190, 234, 209, 0.4)', borderRadius: 12, padding: 10, marginTop: 14 },
  adviceTitle: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 3 },
  adviceBody: { fontSize: 12, color: COLORS.onSurface, lineHeight: 17 },

  profileHeader: { alignItems: 'center', marginVertical: 14 },
  profileAvatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  profileName: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface },
  profileLocation: { fontSize: 12, color: COLORS.onSurfaceVariant },
  profileInfoItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  profileInfoLabel: { fontSize: 11, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  profileInfoValue: { fontSize: 14, color: COLORS.onSurface, fontWeight: '700', marginTop: 1 },
  logoutButton: { marginTop: 20, borderWidth: 1, borderColor: COLORS.error, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  logoutButtonText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216, 194, 181, 0.25)',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surfaceContainerLowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface, marginBottom: 12 },
  langOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 194, 181, 0.2)' },
  activeLangOption: { backgroundColor: COLORS.secondaryContainer, borderRadius: 10, paddingHorizontal: 10 },
  langOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.onSurface },

  voiceModalCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 24, padding: 20, margin: 20, alignItems: 'center' },
  voiceTitle: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginTop: 10 },
  voicePrompt: { fontSize: 13, color: COLORS.onSurfaceVariant, marginVertical: 10, textAlign: 'center', fontStyle: 'italic' },
  stopVoiceButton: { backgroundColor: COLORS.error, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 8, marginTop: 10 },
  stopVoiceText: { color: '#fff', fontWeight: '700', fontSize: 13 }
});
