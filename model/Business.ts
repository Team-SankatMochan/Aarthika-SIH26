import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, readonly, date, relation, children } from '@nozbe/watermelondb/decorators';
import type User from './User';
import type Location from './Location';
import type BusinessAssumption from './BusinessAssumption';
import type StressTest from './StressTest';
import type Pilot from './Pilot';
import type Evidence from './Evidence';
import type Decision from './Decision';
import type FinanceAssessment from './FinanceAssessment';

export default class Business extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'businesses';
    static associations = {
        users: { type: 'belongs_to', key: 'user_id' },
        locations: { type: 'belongs_to', key: 'location_id' },
        business_assumptions: { type: 'has_many', foreignKey: 'business_id' },
        stress_tests: { type: 'has_many', foreignKey: 'business_id' },
        pilots: { type: 'has_many', foreignKey: 'business_id' },
        evidence: { type: 'has_many', foreignKey: 'business_id' },
        decisions: { type: 'has_many', foreignKey: 'business_id' },
        finance_assessments: { type: 'has_many', foreignKey: 'business_id' },
    } as const;

    @field('user_id') userId!: string;
    @field('location_id') locationId!: string;
    @field('business_name') businessName!: string;
    @field('business_category') businessCategory!: string;
    @field('description') description!: string;
    @field('status') status!: string; // planning, testing, validated, financed
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('users', 'user_id') user!: Relation<User>;
    @relation('locations', 'location_id') location!: Relation<Location>;
    @children('business_assumptions') assumptions!: Query<BusinessAssumption>;
    @children('stress_tests') stressTests!: Query<StressTest>;
    @children('pilots') pilots!: Query<Pilot>;
    @children('evidence') evidence!: Query<Evidence>;
    @children('decisions') decisions!: Query<Decision>;
    @children('finance_assessments') financeAssessments!: Query<FinanceAssessment>;
}
