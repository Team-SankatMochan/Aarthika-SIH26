import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Scheme extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'schemes';
    static associations = {
        scheme_rules: { type: 'has_many', foreignKey: 'scheme_id' },
    } as const;

    @field('scheme_name') schemeName!: string;
    @field('scheme_type') schemeType!: string;
    @field('description') description!: string;
    @field('active') active!: boolean;
    
    // P1 fields
    @field('official_source_name') officialSourceName?: string;
    @field('official_source_url') officialSourceUrl?: string;
    @date('last_verified_at') lastVerifiedAt?: number;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;
}
