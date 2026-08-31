import { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../model';
import { CITY_LIST, BUSINESS_TYPE_LIST } from '../../engine/financials';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

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

  const selectedCity = CITY_LIST.find(c => c.key === selectedCityKey);
  const selectedBusiness = BUSINESS_TYPE_LIST.find(b => b.key === selectedBusinessKey);

  const filteredCities = CITY_LIST.filter(c =>
    c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
    c.state.toLowerCase().includes(citySearch.toLowerCase())
  );

  async function handleSubmit() {
    setError('');

    const capitalNum = parseFloat(capital);
    if (!capital || isNaN(capitalNum) || capitalNum <= 0) {
      setError('Please enter a valid margin capital amount');
      return;
    }
    if (!selectedCityKey) {
      setError('Please select your city/location');
      return;
    }
    if (!selectedBusinessKey) {
      setError('Please select your business type');
      return;
    }

    try {
      let newProfile: any;
      await database.write(async () => {
        newProfile = await database.get('profiles').create((p: any) => {
          p.capital = capitalNum;
          p.cityKey = selectedCityKey;
          p.businessTypeKey = selectedBusinessKey;
          p.cityName = selectedCity?.name ?? '';
          p.businessLabel = selectedBusiness?.label ?? '';
          p.tier = selectedCity?.tier ?? '';
        });
      });
      router.push({ pathname: '/dashboard', params: { profileId: newProfile.id } });
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error(err);
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
          <ThemedText type="smallBold" style={styles.label}>
            Margin Capital (₹)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              }
            ]}
            placeholder="Enter amount"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={capital}
            onChangeText={setCapital}
          />
        </View>

        {/* City Picker */}
        <View style={styles.inputGroup}>
          <ThemedText type="smallBold" style={styles.label}>
            Location / City
          </ThemedText>
          <Pressable
            onPress={() => setShowCityPicker(!showCityPicker)}
            style={[
              styles.picker,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              }
            ]}
          >
            <ThemedText themeColor={selectedCity ? 'text' : 'textSecondary'}>
              {selectedCity ? `${selectedCity.name}, ${selectedCity.state}` : 'Select city'}
            </ThemedText>
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
          <ThemedText type="smallBold" style={styles.label}>
            Business Type
          </ThemedText>
          <Pressable
            onPress={() => setShowBusinessPicker(!showBusinessPicker)}
            style={[
              styles.picker,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              }
            ]}
          >
            <ThemedText themeColor={selectedBusiness ? 'text' : 'textSecondary'}>
              {selectedBusiness ? selectedBusiness.label : 'Select business type'}
            </ThemedText>
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
          ]}
        >
          <ThemedText type="smallBold" style={styles.submitText}>
            Calculate Financial Plan
          </ThemedText>
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
  label: {
    marginBottom: Spacing.two,
  },
  input: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
  picker: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
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
