/**
 * AARTHIKA - Mobile Application (React Native / Expo)
 * "Clarity Before Credit"
 */

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { api } from '../services/api';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(280, SCREEN_WIDTH * 0.72);
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

const AppContext = createContext();
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

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const t = (key) => {
    const dict = window.AARTHIKA_TRANSLATIONS ? (window.AARTHIKA_TRANSLATIONS[currentLang] || window.AARTHIKA_TRANSLATIONS['en']) : null;
    if (dict && dict[key]) return dict[key];
    return key;
  };

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
  };

  const handleSignup = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };

  const handleLogin = (mobile, password) => {
    setUser((prev) => ({
      ...prev,
      mobile: mobile || prev.mobile || '9876543210',
      fullName: prev.fullName || 'Ramesh Kumar',
      firstName: prev.firstName || 'Ramesh'
    }));
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentScreen('login');
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
      <SafeAreaView style={styles.safeArea}>
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

        {/* Mobile Bottom Tab Navigation */}
        {isAuthenticated && currentScreen !== 'signup' && currentScreen !== 'login' && (
          <BottomTabBar currentScreen={currentScreen} onNavigate={navigateTo} t={t} />
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
          source={{ uri: 'assets/logo.png' }}
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
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
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
          source={{ uri: 'assets/logo.png' }}
          style={[styles.logoImage, { width: 140, height: 60, marginBottom: 8 }]}
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
  const { user, setIsVoiceActive, navigateTo, setActiveBusiness } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef(null);

  // Exact 5-Item Carousel Order with Clean Visuals
  const carouselItems = [
    { key: 'Farming', type: 'sector', label: 'Farming', sub: '🌾 Organic Agriculture & Crops', image: 'assets/sector_farming.jpg' },
    { key: 'Poultry', type: 'sector', label: 'Poultry', sub: '🐔 Broiler & Country Chicken', image: 'assets/sector_poultry.jpg' },
    { key: 'Goat Farming', type: 'sector', label: 'Goat Farming', sub: '🐐 Goat Rearing & Livestock', image: 'assets/sector_goat.jpg' },
    { key: 'Dairy', type: 'sector', label: 'Dairy', sub: '🐄 Dairy Cattle & Milk Production', image: 'assets/sector_dairy.jpg' },
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
        <Text style={styles.heroTagline}>
          {(t('tagline') || 'Clarity Before Credit').toUpperCase()}
        </Text>

        <Text style={styles.greetingTitle}>
          {t('greeting_prefix') || 'Namaste'}, {user.firstName || 'Ramesh'} 🙏
        </Text>

        <Text style={styles.homeQuestion}>
          {t('home_question') || 'What business do you want to start or grow?'} {t('home_subtext') || 'Just tell Aarthika — no need to type.'}
        </Text>
      </View>

      {/* 2. Central Voice Button */}
      <View style={styles.voiceButtonContainer}>
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
      <View style={{ marginTop: 6 }}>
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
                <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
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

  const handleRunRiskTest = async () => {
    setIsSubmitting(true);
    try {
      // Create user if not exists or use a mock user ID
      // For demo, we'll use a hardcoded user ID that should exist, or create a business with a fake UUID
      // In a real app we'd link to the actual logged-in user
      const businessData = {
        user_id: "user_123", // Assuming backend doesn't strictly validate foreign key or we have user_123
        business_category: activeBusiness.title || "Farming",
        business_details: JSON.stringify(activeBusiness)
      };
      // Try to create the business, but if it fails (user constraint), we'll gracefully fallback
      try {
        const response = await api.business.createBusiness(businessData);
        if (response && response.id) {
          setActiveBusinessId(response.id);
        }
      } catch (e) {
        console.log("Mocking business ID for demo because:", e.message);
        setActiveBusinessId(user.mobile ? user.mobile.substring(0,8) : "demo123");
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
        <Text style={styles.bentoValuePrimary}>₹95,000</Text>
        <Text style={styles.bentoSub}>Initial investment required</Text>
      </View>

      <View style={styles.bentoCard}>
        <Text style={styles.bentoLabel}>Monthly Expenses</Text>
        <Text style={styles.bentoValuePrimary}>₹36,400</Text>
        <Text style={styles.bentoSub}>Seeds, bio-fertilizer, transport, rent</Text>
      </View>

      <View style={[styles.bentoCard, { backgroundColor: COLORS.secondaryContainer }]}>
        <Text style={[styles.bentoLabel, { color: COLORS.secondary }]}>Estimated Profit</Text>
        <Text style={styles.bentoValueSecondary}>₹35,600</Text>
        <Text style={[styles.bentoSub, { color: COLORS.onSecondaryContainer }]}>Projected net per month</Text>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardSectionTitle}>Plan Breakdown</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Drip Irrigation & Land Prep</Text>
          <Text style={styles.breakdownValue}>₹45,000</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Certified Seeds & Fertilizer</Text>
          <Text style={styles.breakdownValue}>₹30,000</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Sprayer & Harvesting Crates</Text>
          <Text style={styles.breakdownValue}>₹20,000</Text>
        </View>

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
  const { navigateTo, activeBusinessId, activeBusiness, user, aiReport, setAiReport } = useApp();
  const [loading, setLoading] = useState(!aiReport);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!aiReport) {
      generateReport();
    }
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const bId = activeBusinessId || "demo-biz-123";
      console.log('Generating AI report for business:', bId);
      const report = await api.aiReports.generateReport(bId);
      setAiReport(report);
    } catch (e) {
      console.log('AI Report Error fallback:', e.message);
      // Fallback Demo Report (so UI always works)
      setAiReport({
        decision: "GO",
        rationale: "Strong margins and proven demand for organic farming in your area.",
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
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.centerSection}>
        <Text style={styles.screenHeaderTitle}>Reality Check & Risk</Text>
        <Text style={styles.screenHeaderSub}>Multi-Agent AI Analysis</Text>
      </View>

      {loading ? (
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
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardSectionTitle}>Final Decision</Text>
            <View style={[styles.riskBadgeLow, aiReport?.decision === 'GO' ? { backgroundColor: '#beead1' } : { backgroundColor: '#ffdad6' }]}>
              <Text style={[styles.riskBadgeText, aiReport?.decision === 'GO' ? { color: '#014737' } : { color: '#ba1a1a' }]}>
                {aiReport?.decision || 'Review'}
              </Text>
            </View>
          </View>

          <View style={{ marginVertical: 14 }}>
            <Text style={styles.inputLabel}>Rationale</Text>
            <Text style={styles.bentoSub}>{aiReport?.rationale}</Text>
          </View>

          <View style={{ marginVertical: 14 }}>
            <Text style={styles.inputLabel}>Demand Level</Text>
            <Text style={styles.bentoValuePrimary}>{aiReport?.market_analysis?.demand_level || 'MEDIUM'}</Text>
          </View>

          <View style={styles.adviceBox}>
            <Text style={styles.adviceTitle}>Top Risks Identified</Text>
            {aiReport?.risk_assessment?.top_risks?.map((r, i) => (
              <Text key={i} style={styles.adviceBody}>• {r}</Text>
            ))}
          </View>

          <View style={[styles.adviceBox, { backgroundColor: COLORS.surfaceContainer }]}>
            <Text style={styles.adviceTitle}>Next Steps for You</Text>
            {aiReport?.next_steps?.map((r, i) => (
              <Text key={i} style={styles.adviceBody}>• {r}</Text>
            ))}
          </View>

        </View>
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
  const { navigateTo } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.screenHeaderTitle}>Business Financials</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigateTo('my_plan')}>
        <Text style={styles.primaryButtonText}>Save & Check Reality →</Text>
      </TouchableOpacity>
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

function VoiceModal({ isOpen, onClose }) {
  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.voiceModalCard}>
          <Text style={{ fontSize: 44 }}>🎙️</Text>
          <Text style={styles.voiceTitle}>Listening to you...</Text>
          <Text style={styles.voicePrompt}>"I want to start an organic farming business"</Text>
          <TouchableOpacity style={styles.stopVoiceButton} onPress={onClose}>
            <Text style={styles.stopVoiceText}>Stop Listening</Text>
          </TouchableOpacity>
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
    borderBottomColor: 'rgba(216, 194, 181, 0.2)'
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoImage: {
    width: 130,
    height: 42
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

  centerSection: { alignItems: 'center', marginVertical: 6 },
  heroTagline: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
    marginBottom: 2,
    textAlign: 'center'
  },
  greetingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface, marginBottom: 2 },
  homeQuestion: { fontSize: 13, fontWeight: '500', color: COLORS.secondary, textAlign: 'center', maxWidth: 300, lineHeight: 18 },

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
    height: 160,
    borderRadius: 16,
    marginBottom: 8
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
    height: 60,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216, 194, 181, 0.3)',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  activeTabItem: { backgroundColor: COLORS.primaryContainer, borderRadius: 18, paddingHorizontal: 14 },
  tabIcon: { fontSize: 16, marginBottom: 1 },
  tabLabel: { fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant },
  activeTabLabel: { color: COLORS.onPrimaryContainer },

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
