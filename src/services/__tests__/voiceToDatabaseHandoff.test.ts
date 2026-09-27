/**
 * AARTHIKA Voice-to-Database-to-Report Handoff Test Suite
 *
 * Verifies the 6 key requirements:
 * 1. STT unavailable error reporting and final transcript event deduplication.
 * 2. Empty input rejection vs. explicit zero ("शून्य", "0", "zero") preservation.
 * 3. Sector preset provenance (SUGGESTED_ESTIMATE remains unconfirmed).
 * 4. Confirmed canonical answers persisting and hydrating across restarts via WatermelonDB schema v5.
 * 5. Sync of confirmed canonical answers to backend assumption payload.
 * 6. Deterministic offline analysis fallback when remote assumption persistence fails.
 */

jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: (objs: any) => objs.web || objs.default,
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-test'),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
      hostUri: 'localhost:8081',
    },
  },
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStorage[key] || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
}));

import { sttService } from '../stt';
import { parseSpokenNumber } from '../numberParser';
import { globalInputStore } from '../../engine/CanonicalInputStore';
import {
  persistCanonicalInputsToWatermelon,
  hydrateCanonicalInputsFromWatermelon,
  syncAssumptionToBackend,
} from '../canonicalPersistence';
import { database } from '../../../model';
import { generateAnalyticsSnapshot, buildAssumptionsPayload } from '../businessAnalytics';
import { api } from '../api';

describe('Aarthika Voice-to-Database-to-Report Handoff Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear global input store
    const existing = globalInputStore.getAllAsRecord();
    for (const key of Object.keys(existing)) {
      globalInputStore.set({
        field: key,
        value: null,
        source: 'USER_PROVIDED',
        confirmed: false,
        timestamp: Date.now(),
      });
    }
  });

  // =========================================================================
  // 1. STT Error Reporting & Deduplication
  // =========================================================================
  describe('1. STT Unavailable & Transcript Deduplication', () => {
    it('reports speech recognition unavailable explicitly with typed input suggestion', () => {
      let errorMessage = '';
      sttService.startListening({
        lang: 'hi',
        onResult: () => {},
        onError: (err) => {
          errorMessage = err;
        },
      });

      expect(errorMessage).toBeTruthy();
      expect(errorMessage).toMatch(/उपलब्ध नहीं है|not available|Please type/i);
    });

    it('does not deliver duplicate final transcript events', () => {
      const results: Array<{ text: string; isFinal: boolean }> = [];

      // Test simulation / provider deduplication behavior
      sttService.setNextResponse('पचास हजार');
      sttService.startListening({
        lang: 'hi',
        onResult: (transcript, isFinal) => {
          results.push({ text: transcript, isFinal });
        },
      });

      // Wait for simulated response tick
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const finalResults = results.filter((r) => r.isFinal);
          // Must deliver the final transcript exactly once
          expect(finalResults.length).toBe(1);
          expect(finalResults[0].text).toBe('पचास हजार');
          resolve();
        }, 350);
      });
    });
  });

  // =========================================================================
  // 2. Empty vs Explicit-Zero Confirmation
  // =========================================================================
  describe('2. Empty vs Explicit-Zero Confirmation', () => {
    it('preserves explicitly spoken zero in Hindi, English, and numeric tokens', () => {
      const zeroHindi = parseSpokenNumber('शून्य');
      expect(zeroHindi.success).toBe(true);
      expect(zeroHindi.value).toBe(0);

      const zeroWord = parseSpokenNumber('zero');
      expect(zeroWord.success).toBe(true);
      expect(zeroWord.value).toBe(0);

      const zeroDigits = parseSpokenNumber('0');
      expect(zeroDigits.success).toBe(true);
      expect(zeroDigits.value).toBe(0);

      const zeroRupees = parseSpokenNumber('0 rupees');
      expect(zeroRupees.success).toBe(true);
      expect(zeroRupees.value).toBe(0);
    });

    it('rejects empty or whitespace-only inputs without defaulting to zero', () => {
      const emptyInput = parseSpokenNumber('');
      expect(emptyInput.success).toBe(false);
      expect(emptyInput.value).toBeNull();

      const whitespaceInput = parseSpokenNumber('   ');
      expect(whitespaceInput.success).toBe(false);
      expect(whitespaceInput.value).toBeNull();

      const uncertainSpeech = parseSpokenNumber('मुझे नहीं पता');
      expect(uncertainSpeech.success).toBe(false);
      expect(uncertainSpeech.value).toBeNull();
    });

    it('parses distinctive spoken numbers correctly', () => {
      const lakhResult = parseSpokenNumber('दो लाख पचास हजार');
      expect(lakhResult.success).toBe(true);
      expect(lakhResult.value).toBe(250000);
    });
  });

  // =========================================================================
  // 3. Sector Preset Provenance
  // =========================================================================
  describe('3. Sector Preset Provenance & Unconfirmed States', () => {
    it('marks sector presets as SUGGESTED_ESTIMATE and unconfirmed', () => {
      // Simulating setting a suggested estimate preset
      globalInputStore.set({
        field: 'monthly_units_sold',
        value: 600,
        source: 'SUGGESTED_ESTIMATE',
        confirmed: false,
        timestamp: Date.now(),
      });

      globalInputStore.set({
        field: 'selling_price_per_unit',
        value: 55,
        source: 'SUGGESTED_ESTIMATE',
        confirmed: false,
        timestamp: Date.now(),
      });

      // Confirmed values map must NOT include unconfirmed presets
      const confirmedValues = globalInputStore.getConfirmedValues();
      expect(confirmedValues.monthly_units_sold).toBeUndefined();
      expect(confirmedValues.selling_price_per_unit).toBeUndefined();

      // When user confirms one field, only that field is promoted to confirmed
      globalInputStore.set({
        field: 'monthly_units_sold',
        value: 750,
        source: 'USER_PROVIDED',
        confirmed: true,
        timestamp: Date.now(),
      });

      const updatedConfirmed = globalInputStore.getConfirmedValues();
      expect(updatedConfirmed.monthly_units_sold).toBe(750);
      expect(updatedConfirmed.selling_price_per_unit).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. Persistence & Hydration across Restarts in WatermelonDB
  // =========================================================================
  describe('4. WatermelonDB Schema v5 Persistence & Hydration', () => {
    it('persists confirmed canonical inputs and hydrates them accurately', async () => {
      const testInputs = {
        monthly_units_sold: 800,
        selling_price_per_unit: 65,
        variable_cost_per_unit: 35,
        monthly_labour_cost: 6000,
        monthly_rent: 3000,
        available_margin_capital: 20000,
        requested_loan_amount: 100000,
        business_category: 'dairy',
      };

      // 1. Persist to WatermelonDB
      const persistResult = await persistCanonicalInputsToWatermelon({
        inputs: testInputs,
        source: 'USER_PROVIDED',
        confirmed: true,
        businessCategory: 'dairy',
        businessName: 'मेरी डेयरी (My Dairy)',
      });

      expect(persistResult.success).toBe(true);
      expect(persistResult.businessId).toBeTruthy();

      // 2. Clear in-memory state (simulate app restart)
      for (const key of Object.keys(testInputs)) {
        globalInputStore.set({
          field: key,
          value: null,
          source: 'USER_PROVIDED',
          confirmed: false,
          timestamp: Date.now(),
        });
      }

      // 3. Hydrate from WatermelonDB
      const hydrated = await hydrateCanonicalInputsFromWatermelon();

      expect(hydrated.hasConfirmedInputs).toBe(true);
      expect(hydrated.businessCategory).toBe('dairy');
      expect(hydrated.inputs.monthly_units_sold).toBe(800);
      expect(hydrated.inputs.selling_price_per_unit).toBe(65);
      expect(hydrated.inputs.variable_cost_per_unit).toBe(35);
      expect(hydrated.inputs.monthly_labour_cost).toBe(6000);
      expect(hydrated.inputs.monthly_rent).toBe(3000);
      expect(hydrated.inputs.available_margin_capital).toBe(20000);

      // Verify globalInputStore has confirmed values
      const confirmedAfterHydration = globalInputStore.getConfirmedValues();
      expect(confirmedAfterHydration.monthly_units_sold).toBe(800);
      expect(confirmedAfterHydration.available_margin_capital).toBe(20000);
    });
  });

  // =========================================================================
  // 5. Backend Assumption Sync
  // =========================================================================
  describe('5. Backend Assumption Sync with Latest Canonical Data', () => {
    it('syncs assumption payload with full canonical fields when backend is configured', async () => {
      const mockBusinessId = 'biz_test_123';
      const payload = buildAssumptionsPayload(
        {
          sector: 'dairy',
          title: 'My Dairy',
          salesPerMonth: 800,
          pricePerUnit: 65,
          costPerUnit: 35,
          monthlyFixed: 9000,
          availableMarginCapital: 20000,
          presetSource: 'USER_PROVIDED',
        },
        mockBusinessId
      );

      const spyCreateAssumption = jest.spyOn(api.business, 'createAssumption').mockResolvedValueOnce({
        id: 'asm_mock_999',
        business_id: mockBusinessId,
        monthly_units_sold: 800,
        selling_price_per_unit: 65,
        variable_cost_per_unit: 35,
        monthly_fixed_cost: 9000,
      } as any);

      const result = await syncAssumptionToBackend(mockBusinessId, payload);

      expect(result.success).toBe(true);
      expect(spyCreateAssumption).toHaveBeenCalledWith(mockBusinessId, payload);
    });
  });

  // =========================================================================
  // 6. Report Fallback Behavior When Assumption Save Fails
  // =========================================================================
  describe('6. Deterministic Offline Fallback When Assumption Save Fails', () => {
    it('handles remote assumption persistence failure gracefully with local analytics', async () => {
      const mockBusinessId = 'biz_test_fail';
      const payload = {
        monthly_units_sold: 500,
        selling_price_per_unit: 50,
      };

      jest.spyOn(api.business, 'createAssumption').mockRejectedValueOnce(new Error('Network offline'));

      const result = await syncAssumptionToBackend(mockBusinessId, payload);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Network offline/i);

      // When remote persistence fails, app generates deterministic local analytics snapshot
      const localPlan = {
        businessCategory: 'retail',
        businessTitle: 'Offline Local Store',
        monthlyUnitsSold: 500,
        sellingPricePerUnit: 50,
        variableCostPerUnit: 30,
        monthlyBusinessFixedCost: 5000,
        setupCost: 50000,
        availableMarginCapital: 10000,
      };

      const snapshot = generateAnalyticsSnapshot(localPlan);
      expect(snapshot.monthlyRevenue).toBe(25000); // 500 * 50
      expect(snapshot.monthlyVariableCost).toBe(15000); // 500 * 30
      expect(snapshot.operatingSurplus).toBe(5000); // 25000 - 15000 - 5000
      expect(snapshot.businessAnalysisAvailable).toBe(true);
      expect(snapshot.overallReadiness).toBeDefined();
    });
  });
});
