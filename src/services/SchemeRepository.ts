import { database } from '../../model';
import Scheme from '../../model/Scheme';
import SchemeRule from '../../model/SchemeRule';
import { Q } from '@nozbe/watermelondb';
import { 
    evaluateAllSchemes, 
    evaluateSchemeCompatibility,
    MatchProfile,
    FreshnessPolicy,
    SchemeGroupResult,
    SchemeRuleInput
} from '../../engine/schemeMatcher';

export class SchemeRepository {
    
    /**
     * Get all active schemes with their rules.
     */
    async getActiveSchemes(): Promise<Scheme[]> {
        return await database.collections
            .get<Scheme>('schemes')
            .query(Q.where('active', true))
            .fetch();
    }

    /**
     * Map WatermelonDB SchemeRule model to the plain object expected by schemeMatcher.
     */
    private mapRuleToInput(rule: SchemeRule): SchemeRuleInput {
        return {
            id: rule.id,
            scheme_id: rule.schemeId,
            rule_version: rule.ruleVersion,
            min_project_cost: rule.minProjectCost,
            max_project_cost: rule.maxProjectCost,
            max_loan_amount: rule.maxLoanAmount,
            active: rule.active,
            // Convert epoch ms to ISO date string for matcher
            effective_from: rule.effectiveFrom ? new Date(rule.effectiveFrom).toISOString().split('T')[0] : null,
            effective_to: rule.effectiveTo ? new Date(rule.effectiveTo).toISOString().split('T')[0] : null,
            location_type: rule.locationType || null,
            allowed_business_categories: rule.allowedBusinessCategories || null,
            last_verified_at: rule.lastVerifiedAt ? new Date(rule.lastVerifiedAt).toISOString() : null,
        };
    }

    /**
     * Get all rules for a scheme
     */
    async getRulesForScheme(schemeId: string): Promise<SchemeRuleInput[]> {
        const rules = await database.collections
            .get<SchemeRule>('scheme_rules')
            .query(Q.where('scheme_id', schemeId))
            .fetch();
            
        return rules.map(this.mapRuleToInput);
    }
    
    /**
     * Get all active rules
     */
    async getAllRules(): Promise<SchemeRuleInput[]> {
        const rules = await database.collections
            .get<SchemeRule>('scheme_rules')
            .query(
                Q.where('active', true)
            )
            .fetch();
            
        return rules.map(this.mapRuleToInput);
    }

    /**
     * Evaluate profile against all active scheme rules in the local database.
     */
    async evaluateProfile(
        profile: MatchProfile,
        evaluationDate: string,
        freshnessPolicy: FreshnessPolicy
    ): Promise<SchemeGroupResult> {
        const rules = await this.getAllRules();
        return evaluateAllSchemes(profile, rules, evaluationDate, freshnessPolicy);
    }
}
