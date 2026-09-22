import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, readonly, date, relation, children } from '@nozbe/watermelondb/decorators';
import type Business from './Business';
import type PilotResult from './PilotResult';

export default class Pilot extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'pilots';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
        pilot_results: { type: 'has_many', foreignKey: 'pilot_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('objective') objective!: string;
    @field('hypothesis') hypothesis!: string;
    @field('duration_days') durationDays!: number;
    @field('status') status!: string; // planned, running, completed
    @date('start_date') startDate!: number;
    @date('end_date') endDate!: number;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;
    @children('pilot_results') results!: Query<PilotResult>;
}
