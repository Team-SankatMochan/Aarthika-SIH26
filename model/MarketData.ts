import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Location from './Location';
import type Business from './Business';

export default class MarketData extends Model {
    static table = 'market_data';
    static associations = {
        locations: { type: 'belongs_to', key: 'location_id' },
        businesses: { type: 'belongs_to', key: 'business_id' },
    } as const;

    @field('location_id') locationId!: string;
    @field('business_id') businessId!: string;
    @field('data_type') dataType!: string; // demand, price, cost, competition
    @field('source') source!: string;
    @field('value') value!: number;
    @field('unit') unit!: string;
    @date('observation_date') observationDate!: number;
    @field('confidence') confidence!: number;
    @field('is_observed') isObserved!: boolean;
    @field('is_estimated') isEstimated!: boolean;
    @field('metadata_json') metadataJson!: string;
    @readonly @date('created_at') createdAt!: number;

    @relation('locations', 'location_id') location!: Relation<Location>;
    @relation('businesses', 'business_id') business!: Relation<Business>;

    get metadata(): any {
        try {
            return this.metadataJson ? JSON.parse(this.metadataJson) : null;
        } catch {
            return null;
        }
    }
}
