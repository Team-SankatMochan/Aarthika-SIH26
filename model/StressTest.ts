import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, readonly, date, relation, children } from '@nozbe/watermelondb/decorators';
import type Business from './Business';
import type BusinessAssumption from './BusinessAssumption';
import type StressTestScenario from './StressTestScenario';

export default class StressTest extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'stress_tests';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
        business_assumptions: { type: 'belongs_to', key: 'base_assumption_id' },
        stress_test_scenarios: { type: 'has_many', foreignKey: 'stress_test_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('base_assumption_id') baseAssumptionId!: string;
    @field('name') name!: string;
    @field('description') description!: string;
    @field('status') status!: string; // pending, running, completed
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;
    @relation('business_assumptions', 'base_assumption_id') baseAssumption!: Relation<BusinessAssumption>;
    @children('stress_test_scenarios') scenarios!: Query<StressTestScenario>;
}
