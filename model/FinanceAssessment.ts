import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Business from './Business';

export default class FinanceAssessment extends Model {
    static table = 'finance_assessments';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('scheme_id') schemeId!: string;
    @field('scheme_rule_id') schemeRuleId!: string;
    @field('project_cost') projectCost!: number;
    @field('margin_contribution') marginContribution!: number;
    @field('maximum_loan') maximumLoan!: number;
    @field('recommended_loan') recommendedLoan!: number;
    @field('annual_interest_rate') annualInterestRate!: number;
    @field('total_tenure_months') totalTenureMonths!: number;
    @field('moratorium_months') moratoriumMonths!: number;
    @field('active_repayment_months') activeRepaymentMonths!: number;
    @field('capitalized_principal') capitalizedPrincipal!: number;
    @field('emi') emi!: number;
    @field('total_interest') totalInterest!: number;
    @field('debt_affordability_status') debtAffordabilityStatus!: string; // AFFORDABLE, STRETCHED, UNSUSTAINABLE
    @field('debt_service_burden') debtServiceBurden!: number;
    @field('working_capital_requirement') workingCapitalRequirement!: number;
    @field('calculation_version') calculationVersion!: number;
    @readonly @date('created_at') createdAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;

    get totalRepayment(): number {
        return this.emi * this.activeRepaymentMonths;
    }

    get isAffordable(): boolean {
        return this.debtAffordabilityStatus === 'AFFORDABLE';
    }
}
