import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Scheme extends Model {
    static table = 'schemes';
    static associations = {
        scheme_rules: { type: 'has_many', foreignKey: 'scheme_id' },
    } as const;

    @field('scheme_name') schemeName!: string;
    @field('scheme_type') schemeType!: string;
    @field('description') description!: string;
    @field('active') active!: boolean;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;
}
