import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Business from './Business';

export default class Evidence extends Model {
    /**
     * Represents the PostgreSQL BIGINT monotonic global sync sequence revision.
     * Represented as JS number for current SIH prototype scale without creating a second revision system.
     */
    @field('server_revision') serverRevision!: number;
    static table = 'evidence';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('evidence_type') evidenceType!: string; // market, pilot, financial, customer
    @field('source') source!: string;
    @field('description') description!: string;
    @field('value') value!: number;
    @field('confidence') confidence!: number;
    @field('is_observed') isObserved!: boolean;
    @field('is_estimated') isEstimated!: boolean;
    @readonly @date('created_at') createdAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;
}
