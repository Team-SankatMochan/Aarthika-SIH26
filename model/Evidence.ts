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
    
    // Canonical fields
    @field('source_type') sourceType!: string;
    @field('provider_id') providerId!: string;
    @field('provider_record_id') providerRecordId!: string;
    @field('evidence_type') evidenceType!: string;
    @field('source_name') sourceName!: string;
    @field('source_url') sourceUrl!: string;
    @field('metric_name') metricName!: string;
    
    // Values - numeric value stored as string to preserve Decimal precision
    @field('numeric_value') numericValue!: string;
    @field('text_value') textValue!: string;
    @field('boolean_value') booleanValue!: boolean;
    
    // Metadata
    @field('observation_date') observationDate!: number;
    @field('retrieved_at') retrievedAt!: number;
    @field('state') state!: string;
    @field('district') district!: string;
    @field('commodity') commodity!: string;
    @field('market_id') marketId!: string;
    @field('market_name') marketName!: string;
    @field('price_type') priceType!: string;
    @field('currency') currency!: string;
    @field('quantity_unit') quantityUnit!: string;
    @field('content_hash') contentHash!: string;
    @field('derivation_type') derivationType!: string;
    @field('derivation_version') derivationVersion!: string;

    // Legacy fields (kept temporarily for migration compat)
    @field('source') source!: string;
    @field('description') description!: string;
    @field('value') value!: number;
    @field('confidence') confidence!: number;
    @field('is_observed') isObserved!: boolean;
    @field('is_estimated') isEstimated!: boolean;
    
    @readonly @date('created_at') createdAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;
}
