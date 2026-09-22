import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Scheme from './Scheme';

export default class SchemeRule extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'scheme_rules';
    static associations = {
        schemes: { type: 'belongs_to', key: 'scheme_id' },
    } as const;

    @field('scheme_id') schemeId!: string;
    @field('min_project_cost') minProjectCost!: number;
    @field('max_project_cost') maxProjectCost!: number;
    @field('financing_percentage') financingPercentage!: number;
    @field('max_loan_amount') maxLoanAmount!: number;
    @field('annual_interest_rate') annualInterestRate!: number;
    @field('tenure_months') tenureMonths!: number;
    @field('moratorium_months') moratoriumMonths!: number;
    @date('effective_from') effectiveFrom!: number;
    @date('effective_to') effectiveTo!: number;
    @field('active') active!: boolean;
    
    // P1 fields
    @field('rule_version') ruleVersion!: number;
    @field('moratorium_interest_method') moratoriumInterestMethod!: string;
    @field('location_type') locationType?: string;
    @field('allowed_business_categories') allowedBusinessCategories?: string; // JSON string
    @field('source_name') sourceName?: string;
    @field('source_url') sourceUrl?: string;
    @date('last_verified_at') lastVerifiedAt?: number;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('schemes', 'scheme_id') scheme!: Relation<Scheme>;
}
