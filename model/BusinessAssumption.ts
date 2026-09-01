import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Business from './Business';

export default class BusinessAssumption extends Model {
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
