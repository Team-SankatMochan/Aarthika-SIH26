import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Scheme from './Scheme';

export default class SchemeRule extends Model {
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
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('schemes', 'scheme_id') scheme!: Relation<Scheme>;
}
