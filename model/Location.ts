import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Location extends Model {
    static table = 'locations';
    static associations = {
        users: { type: 'has_many', foreignKey: 'location_id' },
        businesses: { type: 'has_many', foreignKey: 'location_id' },
        market_data: { type: 'has_many', foreignKey: 'location_id' },
    } as const;

    @field('state') state!: string;
    @field('district') district!: string;
    @field('block') block!: string;
    @field('village_or_city') villageOrCity!: string;
    @field('latitude') latitude!: number;
    @field('longitude') longitude!: number;
    @readonly @date('created_at') createdAt!: number;
    @date('updated_at') updatedAt!: number;

    get fullName(): string {
        const parts = [
            this.villageOrCity,
            this.block,
            this.district,
            this.state,
        ].filter(Boolean);
        return parts.join(', ');
    }
}
