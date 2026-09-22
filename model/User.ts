import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Location from './Location';

export default class User extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'users';
    static associations = {
        locations: { type: 'belongs_to', key: 'location_id' },
        businesses: { type: 'has_many', foreignKey: 'user_id' },
    } as const;

    @field('name') name!: string;
    @field('phone') phone!: string;
    @field('location_id') locationId!: string;
    @field('available_capital') availableCapital!: number;
    @field('skills') skillsJson!: string;
    @field('experience') experience!: string;
    @field('assets') assetsJson!: string;
    @field('family_workforce') familyWorkforce!: number;
    @field('preferences') preferencesJson!: string;
    @field('risk_tolerance') riskTolerance!: string;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    @relation('locations', 'location_id') location!: Relation<Location>;

    // Helpers
    get skills(): any {
        try {
            return this.skillsJson ? JSON.parse(this.skillsJson) : null;
        } catch {
            return null;
        }
    }

    get assets(): any {
        try {
            return this.assetsJson ? JSON.parse(this.assetsJson) : null;
        } catch {
            return null;
        }
    }

    get preferences(): any {
        try {
            return this.preferencesJson ? JSON.parse(this.preferencesJson) : null;
        } catch {
            return null;
        }
    }
}
