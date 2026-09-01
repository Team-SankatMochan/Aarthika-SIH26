import { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../model';
import { CITY_LIST, BUSINESS_TYPE_LIST } from '../../engine/financials';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { TIER_BADGES } from '@/constants/icons';

export default function InputScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [capital, setCapital] = useState('');
  const [selectedCityKey, setSelectedCityKey] = useState<string>('');
  const [selectedBusinessKey, setSelectedBusinessKey] = useState<string>('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showBusinessPicker, setShowBusinessPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedCity = CITY_LIST.find(c => c.key === selectedCityKey);
  const selectedBusiness = BUSINESS_TYPE_LIST.find(b => b.key === selectedBusinessKey);

  const filteredCities = CITY_LIST.filter(c =>
    c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
    c.state.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Validation helpers
  const capitalNum = parseFloat(capital);
  const isCapitalValid = capital.length > 0 && !isNaN(capitalNum) && capitalNum > 0;
  const isCityValid = selectedCityKey.length > 0;
  const isBusinessValid = selectedBusinessKey.length > 0;

  async function handleSubmit() {
    setError('');

    if (!isCapitalValid) {
      setError('Please enter a valid margin capital amount');
      return;
    }
    if (!isCityValid) {
      setError('Please select your city/location');
      return;
    }
    if (!isBusinessValid) {
      setError('Please select your business type');
      return;
    }

    setLoading(true);
    try {
      let newUser: any;
      let newBusiness: any;
      await database.write(async () => {
        // Create User
        newUser = await database.get('users').create((u: any) => {
          u.name = `Entrepreneur ${Math.floor(Math.random() * 1000)}`; // Default name for now
          u.locationId = selectedCityKey; // Using city key as a proxy for location_id for now
          u.availableCapital = capitalNum;
        });

        // Create Business linked to user
        newBusiness = await database.get('businesses').create((b: any) => {
          b.userId = newUser.id;
          b.locationId = selectedCityKey;
          b.businessName = `My ${selectedBusiness?.label ?? 'Business'}`;
          b.businessCategory = selectedBusinessKey;
          b.status = 'planning';
        });

        // For backward compatibility until Dashboard works with new models
        await database.get('profiles').create((p: any) => {
          p.capital = capitalNum;
          p.cityKey = selectedCityKey;
          p.businessTypeKey = selectedBusinessKey;
          p.cityName = selectedCity?.name ?? '';
          p.businessLabel = selectedBusiness?.label ?? '';
          p.tier = selectedCity?.tier ?? '';
        });
      });

      // Small delay for better UX
      setTimeout(() => {
        // Pass businessId for new flow, profileId for backward compatibility
        router.push({
          pathname: '/dashboard',
          params: { profileId: newBusiness.id } // Still passing as profileId to not break dashboard
        });
      }, 300);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Financial Planning
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Enter your business details to get started
          </ThemedText>
        </View>

        {/* Margin Capital Input */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <ThemedText type="smallBold" style={styles.label}>
              Margin Capital (₹)
            </ThemedText>
            {isCapitalValid && (
              <ThemedText style={styles.validCheck}>✓</ThemedText>
            )}
          </View>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
                borderColor: isCapitalValid ? '#639922' : theme.backgroundSelected,
                borderWidth: isCapitalValid ? 2 : 1,
              }
            ]}
            placeholder="Enter amount"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={capital}
            onChangeText={setCapital}
            editable={!loading}
          />
        </View>

        {/* City Picker */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <ThemedText type="smallBold" style={styles.label}>
              Location / City
            </ThemedText>
            {isCityValid && (
              <ThemedText style={styles.validCheck}>✓</ThemedText>
            )}
          </View>
          <Pressable
            onPress={() => !loading && setShowCityPicker(!showCityPicker)}
            style={[
              styles.picker,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: isCityValid ? '#639922' : theme.backgroundSelected,
                borderWidth: isCityValid ? 2 : 1,
              }
            ]}
            disabled={loading}
          >
            <View style={styles.pickerContent}>
              <ThemedText themeColor={selectedCity ? 'text' : 'textSecondary'}>
                {selectedCity ? `${selectedCity.name}, ${selectedCity.state}` : 'Select city'}
              </ThemedText>
              {selectedCity && (
                <View style={[styles.miniTierBadge, { backgroundColor: TIER_BADGES[selectedCity.tier].color + '20' }]}>
                  <ThemedText type="small" style={[styles.miniTierText, { color: TIER_BADGES[selectedCity.tier].color }]}>
                    {TIER_BADGES[selectedCity.tier].icon}
                  </ThemedText>
                </View>
              )}
            </View>
          </Pressable>

          {showCityPicker && (
            <View style={[styles.dropdown, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  }
                ]}
                placeholder="Search cities..."
                placeholderTextColor={theme.textSecondary}
                value={citySearch}
                onChangeText={setCitySearch}
              />
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filteredCities.map(city => (
                  <Pressable
                    key={city.key}
                    style={[
                      styles.dropdownItem,
                      selectedCityKey === city.key && { backgroundColor: theme.backgroundSelected }
                    ]}
                    onPress={() => {
                      setSelectedCityKey(city.key);
                      setShowCityPicker(false);
                      setCitySearch('');
                    }}
                  >
                    <ThemedText type="small">{city.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.cityState}>
                      {city.state}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Business Type Picker */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <ThemedText type="smallBold" style={styles.label}>
              Business Type
            </ThemedText>
            {isBusinessValid && (
              <ThemedText style={styles.validCheck}>✓</ThemedText>
            )}
          </View>
          <Pressable
            onPress={() => !loading && setShowBusinessPicker(!showBusinessPicker)}
            style={[
              styles.picker,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: isBusinessValid ? '#639922' : theme.backgroundSelected,
                borderWidth: isBusinessValid ? 2 : 1,
              }
            ]}
            disabled={loading}
          >
            <View style={styles.pickerContent}>
              <ThemedText themeColor={selectedBusiness ? 'text' : 'textSecondary'}>
                {selectedBusiness ? selectedBusiness.label : 'Select business type'}
              </ThemedText>
              {selectedBusiness && (
                <View style={styles.miniMarginBadge}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {(selectedBusiness.marginPercent * 100).toFixed(0)}%
                  </ThemedText>
                </View>
              )}
            </View>
          </Pressable>

          {showBusinessPicker && (
            <View style={[styles.dropdown, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {BUSINESS_TYPE_LIST.map(business => (
                  <Pressable
                    key={business.key}
                    style={[
                      styles.dropdownItem,
                      selectedBusinessKey === business.key && { backgroundColor: theme.backgroundSelected }
                    ]}
                    onPress={() => {
                      setSelectedBusinessKey(business.key);
                      setShowBusinessPicker(false);
                    }}
                  >
                    <ThemedText type="small">{business.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.businessMargin}>
                      {(business.marginPercent * 100).toFixed(0)}% margin
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            loading && styles.submitButtonDisabled,
          ]}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator size="small" color="#FFF" />
              <ThemedText type="smallBold" style={styles.submitText}>
                Saving...
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="smallBold" style={styles.submitText}>
              Calculate Financial Plan
            </ThemedText>
          )}
        </Pressable>

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
            All calculations are performed offline. Your data stays on your device.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
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
  header: {
    marginBottom: Spacing.five,
  },
  title: {
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: Spacing.four,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  label: {
    marginBottom: 0,
  },
  validCheck: {
    fontSize: 18,
    color: '#639922',
    fontWeight: 'bold',
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
  picker: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  pickerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniTierBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniTierText: {
    fontSize: 14,
  },
  miniMarginBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#639922' + '20',
  },
  dropdown: {
    marginTop: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 280,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  searchInput: {
    height: 44,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  dropdownItem: {
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  cityState: {
    marginTop: 2,
    fontSize: 12,
  },
  businessMargin: {
    marginTop: 2,
    fontSize: 12,
  },
  errorContainer: {
    backgroundColor: '#FEE',
    padding: Spacing.three,
    borderRadius: 8,
    marginBottom: Spacing.four,
    borderLeftWidth: 4,
    borderLeftColor: '#E24B4A',
  },
  errorText: {
    color: '#C00',
  },
  submitButton: {
    height: 56,
    backgroundColor: '#0274DF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitButtonPressed: {
    opacity: 0.8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
  },
  footer: {
    marginTop: Spacing.five,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
  },
});
