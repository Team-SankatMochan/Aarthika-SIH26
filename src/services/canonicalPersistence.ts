/**
 * AARTHIKA Canonical Persistence & Hydration Service
 * Unifies WatermelonDB schema v5 persistence and hydration across VoiceModal,
 * Rural Interview, My Plan, and Risk Test screens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../../model';
import { globalInputStore, ProvenanceSource } from '../engine/CanonicalInputStore';
import { api, isBackendConfigured } from './api';
import User from '../../model/User';
import Business from '../../model/Business';
import BusinessAssumption from '../../model/BusinessAssumption';
import Location from '../../model/Location';

export const USER_ID_KEY = '@aarthika_active_user_id';
export const BUSINESS_ID_KEY = '@aarthika_active_business_id';

export interface PersistOptions {
  userId?: string;
  businessId?: string;
  businessName?: string;
  businessCategory?: string;
  location?: string;
  inputs: Record<string, any>;
  source?: ProvenanceSource;
  confirmed?: boolean;
}

export interface HydrateResult {
  userId: string | null;
  businessId: string | null;
  businessName?: string;
  businessCategory?: string;
  location?: string;
  inputs: Record<string, any>;
  hasConfirmedInputs: boolean;
}

/**
 * Get or create stable local user and business records in WatermelonDB.
 */
export async function getOrCreateStableEntityIds(): Promise<{ userId: string; businessId: string }> {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  let businessId = await AsyncStorage.getItem(BUSINESS_ID_KEY);

  if (!userId) {
    // Generate deterministic local id or check existing user in database
    try {
      const usersCollection = database.get<User>('users');
      const existingUsers = await usersCollection.query().fetch();
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await database.write(async () => {
          await usersCollection.create((user) => {
            (user as any)._raw.id = userId;
            user.name = 'उद्यमी (Entrepreneur)';
            user.phone = '0000000000';
            user.locationId = 'loc_default';
            user.availableCapital = 0;
            user.skillsJson = '[]';
            user.experience = 'beginner';
            user.assetsJson = '[]';
            user.familyWorkforce = 1;
            user.preferencesJson = '{}';
            user.riskTolerance = 'moderate';
          });
        });
      }
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    } catch (e) {
      console.warn('[Persistence] Error ensuring user in WatermelonDB:', e);
      userId = userId || 'usr_local_default';
    }
  }

  if (!businessId) {
    try {
      const businessesCollection = database.get<Business>('businesses');
      const existingBiz = await businessesCollection.query().fetch();
      if (existingBiz.length > 0) {
        businessId = existingBiz[0].id;
      } else {
        businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await database.write(async () => {
          await businessesCollection.create((biz) => {
            (biz as any)._raw.id = businessId;
            biz.userId = userId!;
            biz.locationId = 'loc_default';
            biz.businessName = 'मेरा व्यवसाय (My Business)';
            biz.businessCategory = 'dairy';
            biz.description = 'ग्रामीण सूक्ष्म उद्यम (Rural Micro-Enterprise)';
            biz.status = 'planning';
          });
        });
      }
      await AsyncStorage.setItem(BUSINESS_ID_KEY, businessId);
    } catch (e) {
      console.warn('[Persistence] Error ensuring business in WatermelonDB:', e);
      businessId = businessId || 'biz_local_default';
    }
  }

  return { userId, businessId };
}

/**
 * Persist confirmed canonical inputs to WatermelonDB schema v5.
 */
export async function persistCanonicalInputsToWatermelon(
  options: PersistOptions
): Promise<{ success: boolean; businessId: string; assumptionId?: string }> {
  try {
    const { userId, businessId } = await getOrCreateStableEntityIds();
    const activeBusinessId = options.businessId || businessId;

    const inputs = options.inputs;
    const source = options.source || 'USER_PROVIDED';

    await database.write(async () => {
      const businessesCollection = database.get<Business>('businesses');
      const assumptionsCollection = database.get<BusinessAssumption>('business_assumptions');

      // 1. Update business category / name / location if available
      try {
        const bizRecord = await businessesCollection.find(activeBusinessId);
        if (bizRecord) {
          await bizRecord.update((biz) => {
            if (options.businessName) biz.businessName = options.businessName;
            if (options.businessCategory || inputs.business_category) {
              biz.businessCategory = options.businessCategory || inputs.business_category;
            }
          });
        }
      } catch (_e) {
        // Record might not exist yet, create it
        try {
          await businessesCollection.create((biz) => {
            (biz as any)._raw.id = activeBusinessId;
            biz.userId = options.userId || userId;
            biz.locationId = 'loc_default';
            biz.businessName = options.businessName || 'मेरा व्यवसाय (My Business)';
            biz.businessCategory = options.businessCategory || inputs.business_category || 'general';
            biz.description = 'ग्रामीण सूक्ष्म उद्यम (Rural Micro-Enterprise)';
            biz.status = 'planning';
          });
        } catch (err) {
          console.warn('[Persistence] Business record creation notice:', err);
        }
      }

      // 2. Compute canonical + legacy fields
      const monthlyUnitsSold = inputs.monthly_units_sold !== undefined && inputs.monthly_units_sold !== null ? Number(inputs.monthly_units_sold) : undefined;
      const sellingPrice = inputs.selling_price_per_unit !== undefined && inputs.selling_price_per_unit !== null ? Number(inputs.selling_price_per_unit) : undefined;
      const varCost = inputs.variable_cost_per_unit !== undefined && inputs.variable_cost_per_unit !== null ? Number(inputs.variable_cost_per_unit) : undefined;
      const labour = inputs.monthly_labour_cost !== undefined && inputs.monthly_labour_cost !== null ? Number(inputs.monthly_labour_cost) : undefined;
      const rent = inputs.monthly_rent !== undefined && inputs.monthly_rent !== null ? Number(inputs.monthly_rent) : undefined;
      const transport = inputs.monthly_transport_cost !== undefined && inputs.monthly_transport_cost !== null ? Number(inputs.monthly_transport_cost) : undefined;
      const otherFixed = inputs.monthly_other_fixed_cost !== undefined && inputs.monthly_other_fixed_cost !== null ? Number(inputs.monthly_other_fixed_cost) : undefined;
      const reqLoan = inputs.requested_loan_amount !== undefined && inputs.requested_loan_amount !== null ? Number(inputs.requested_loan_amount) : undefined;
      const workingCap = inputs.working_capital_required !== undefined && inputs.working_capital_required !== null ? Number(inputs.working_capital_required) : undefined;
      const hhIncome = inputs.monthly_household_nonbusiness_income !== undefined && inputs.monthly_household_nonbusiness_income !== null ? Number(inputs.monthly_household_nonbusiness_income) : undefined;
      const hhExpenses = inputs.monthly_household_essential_expenses !== undefined && inputs.monthly_household_essential_expenses !== null ? Number(inputs.monthly_household_essential_expenses) : undefined;
      const hhDebt = inputs.existing_monthly_household_debt_payments !== undefined && inputs.existing_monthly_household_debt_payments !== null ? Number(inputs.existing_monthly_household_debt_payments) : undefined;
      const marginCap = inputs.available_margin_capital !== undefined && inputs.available_margin_capital !== null ? Number(inputs.available_margin_capital) : undefined;
      const projCost = inputs.project_cost !== undefined && inputs.project_cost !== null ? Number(inputs.project_cost) : undefined;

      // Find if there is an existing assumption for this business
      const existingAssumptions = await assumptionsCollection.query().fetch();
      const currentAssumptions = existingAssumptions.filter((a) => a.businessId === activeBusinessId);

      const populateFields = (assumption: BusinessAssumption) => {
        // Canonical v5 fields
        assumption.monthlyUnitsSold = monthlyUnitsSold;
        assumption.sellingPricePerUnit = sellingPrice;
        assumption.variableCostPerUnit = varCost;
        assumption.monthlyLabourCost = labour;
        assumption.monthlyRent = rent;
        assumption.monthlyTransportCost = transport;
        assumption.monthlyOtherFixedCost = otherFixed;
        assumption.requestedLoanAmount = reqLoan;
        assumption.workingCapitalRequired = workingCap;
        assumption.monthlyHouseholdNonbusinessIncome = hhIncome;
        assumption.monthlyHouseholdEssentialExpenses = hhExpenses;
        assumption.existingMonthlyHouseholdDebtPayments = hhDebt;
        assumption.availableMarginCapital = marginCap;
        assumption.projectCost = projCost;

        // Legacy fields for backward compatibility
        assumption.expectedCustomers = monthlyUnitsSold ?? 0;
        assumption.sellingPrice = sellingPrice ?? 0;
        assumption.productionVolume = monthlyUnitsSold ?? 0;
        assumption.rawMaterialCost = (monthlyUnitsSold && varCost) ? monthlyUnitsSold * varCost : 0;
        assumption.labourCost = labour ?? 0;
        assumption.rent = rent ?? 0;
        assumption.transportCost = transport ?? 0;
        assumption.workingCapital = workingCap ?? 0;
        assumption.proposedLoanAmount = reqLoan ?? 0;
        assumption.otherOperatingCost = otherFixed ?? 0;
        assumption.assumptionSource = source;
        assumption.confidence = 1.0;
      };

      if (currentAssumptions.length > 0) {
        await currentAssumptions[0].update((a) => {
          populateFields(a);
        });
      } else {
        await assumptionsCollection.create((a) => {
          a.businessId = activeBusinessId;
          populateFields(a);
        });
      }
    });

    return { success: true, businessId: activeBusinessId };
  } catch (error) {
    console.warn('[Persistence] Error saving canonical inputs to WatermelonDB:', error);
    return { success: false, businessId: options.businessId || 'biz_local_default' };
  }
}

/**
 * Hydrate canonical inputs from WatermelonDB into CanonicalInputStore.
 */
export async function hydrateCanonicalInputsFromWatermelon(): Promise<HydrateResult> {
  try {
    const { userId, businessId } = await getOrCreateStableEntityIds();

    const businessesCollection = database.get<Business>('businesses');
    const assumptionsCollection = database.get<BusinessAssumption>('business_assumptions');

    let businessName: string | undefined;
    let businessCategory: string | undefined;
    let location: string | undefined;

    try {
      const biz = await businessesCollection.find(businessId);
      if (biz) {
        businessName = biz.businessName;
        businessCategory = biz.businessCategory;
      }
    } catch (_e) {
      // ignore
    }

    const allAssumptions = await assumptionsCollection.query().fetch();
    const activeAssumption = allAssumptions.find((a) => a.businessId === businessId) || allAssumptions[0];

    const inputs: Record<string, any> = {};
    let hasConfirmed = false;

    if (businessCategory) {
      inputs.business_category = businessCategory;
      if (globalInputStore.get('business_category')?.value === undefined) {
        globalInputStore.set({
          field: 'business_category',
          value: businessCategory,
          source: 'USER_PROVIDED',
          confirmed: true,
          timestamp: Date.now(),
        });
      }
      hasConfirmed = true;
    }

    if (activeAssumption) {
      const fieldMap: Array<{ storeKey: string; val: any; unit?: string }> = [
        { storeKey: 'monthly_units_sold', val: activeAssumption.monthlyUnitsSold ?? (activeAssumption.productionVolume > 0 ? activeAssumption.productionVolume : undefined) },
        { storeKey: 'selling_price_per_unit', val: activeAssumption.sellingPricePerUnit ?? (activeAssumption.sellingPrice > 0 ? activeAssumption.sellingPrice : undefined) },
        { storeKey: 'variable_cost_per_unit', val: activeAssumption.variableCostPerUnit },
        { storeKey: 'monthly_labour_cost', val: activeAssumption.monthlyLabourCost ?? (activeAssumption.labourCost > 0 ? activeAssumption.labourCost : undefined) },
        { storeKey: 'monthly_rent', val: activeAssumption.monthlyRent ?? (activeAssumption.rent > 0 ? activeAssumption.rent : undefined) },
        { storeKey: 'monthly_transport_cost', val: activeAssumption.monthlyTransportCost ?? (activeAssumption.transportCost > 0 ? activeAssumption.transportCost : undefined) },
        { storeKey: 'monthly_other_fixed_cost', val: activeAssumption.monthlyOtherFixedCost ?? (activeAssumption.otherOperatingCost > 0 ? activeAssumption.otherOperatingCost : undefined) },
        { storeKey: 'requested_loan_amount', val: activeAssumption.requestedLoanAmount ?? (activeAssumption.proposedLoanAmount > 0 ? activeAssumption.proposedLoanAmount : undefined) },
        { storeKey: 'working_capital_required', val: activeAssumption.workingCapitalRequired ?? (activeAssumption.workingCapital > 0 ? activeAssumption.workingCapital : undefined) },
        { storeKey: 'monthly_household_nonbusiness_income', val: activeAssumption.monthlyHouseholdNonbusinessIncome },
        { storeKey: 'monthly_household_essential_expenses', val: activeAssumption.monthlyHouseholdEssentialExpenses },
        { storeKey: 'existing_monthly_household_debt_payments', val: activeAssumption.existingMonthlyHouseholdDebtPayments },
        { storeKey: 'available_margin_capital', val: activeAssumption.availableMarginCapital },
        { storeKey: 'project_cost', val: activeAssumption.projectCost },
      ];

      for (const item of fieldMap) {
        if (item.val !== undefined && item.val !== null) {
          inputs[item.storeKey] = item.val;
          hasConfirmed = true;
          // Set in canonical input store
          globalInputStore.set({
            field: item.storeKey,
            value: item.val,
            source: (activeAssumption.assumptionSource as ProvenanceSource) || 'USER_PROVIDED',
            confirmed: true,
            timestamp: Date.now(),
          });
        }
      }
    }

    return {
      userId,
      businessId,
      businessName,
      businessCategory,
      location,
      inputs,
      hasConfirmedInputs: hasConfirmed,
    };
  } catch (error) {
    console.warn('[Persistence] Error hydrating canonical inputs from WatermelonDB:', error);
    return {
      userId: null,
      businessId: null,
      inputs: {},
      hasConfirmedInputs: false,
    };
  }
}

/**
 * Sync assumption to backend and verify persistence before AI report generation.
 */
export async function syncAssumptionToBackend(
  businessId: string,
  assumptionPayload: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isBackendConfigured) {
    return {
      success: false,
      error: 'BACKEND_OFFLINE: Remote API is not configured. Deterministic local analysis will be used.',
    };
  }

  try {
    const res = await api.business.createAssumption(businessId, assumptionPayload);
    return { success: true, data: res };
  } catch (err: any) {
    console.warn('[Persistence] Failed to sync assumption to backend:', err);
    return {
      success: false,
      error: err.message || 'Network error while persisting assumption to server.',
    };
  }
}
