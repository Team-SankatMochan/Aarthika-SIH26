import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Business from './Business';

export default class BusinessAssumption extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'business_assumptions';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
        stress_tests: { type: 'has_many', foreignKey: 'base_assumption_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('expected_customers') expectedCustomers!: number;
    @field('selling_price') sellingPrice!: number;
    @field('production_volume') productionVolume!: number;
    @field('raw_material_cost') rawMaterialCost!: number;
    @field('labour_cost') labourCost!: number;
    @field('rent') rent!: number;
    @field('transport_cost') transportCost!: number;
    @field('working_capital') workingCapital!: number;
    @field('proposed_loan_amount') proposedLoanAmount!: number;
    @field('other_operating_cost') otherOperatingCost!: number;
    @field('monthly_units_sold') monthlyUnitsSold?: number;
    @field('unit_of_measure') unitOfMeasure?: string;
    @field('selling_price_per_unit') sellingPricePerUnit?: number;
    @field('variable_cost_per_unit') variableCostPerUnit?: number;
    @field('monthly_labour_cost') monthlyLabourCost?: number;
    @field('monthly_rent') monthlyRent?: number;
    @field('monthly_transport_cost') monthlyTransportCost?: number;
    @field('monthly_other_fixed_cost') monthlyOtherFixedCost?: number;
    @field('requested_loan_amount') requestedLoanAmount?: number;
    @field('working_capital_required') workingCapitalRequired?: number;
    @field('monthly_household_nonbusiness_income') monthlyHouseholdNonbusinessIncome?: number;
    @field('monthly_household_essential_expenses') monthlyHouseholdEssentialExpenses?: number;
    @field('existing_monthly_household_debt_payments') existingMonthlyHouseholdDebtPayments?: number;
    @field('monthly_fixed_cost') monthlyFixedCost?: number;
    @field('available_margin_capital') availableMarginCapital?: number;
    @field('project_cost') projectCost?: number;
    @field('assumption_source') assumptionSource!: string;
    @field('confidence') confidence!: number;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;

    // Calculated fields
    get monthlyRevenue(): number {
        if (this.productionVolume > 0) {
            return this.productionVolume * this.sellingPrice;
        }
        return this.expectedCustomers * this.sellingPrice * 30; // Assuming daily customers
    }

    get totalOperatingCost(): number {
        return (
            this.rawMaterialCost +
            this.labourCost +
            this.rent +
            this.transportCost +
            this.otherOperatingCost
        );
    }

    get monthlyCashSurplus(): number {
        return this.monthlyRevenue - this.totalOperatingCost;
    }
}
