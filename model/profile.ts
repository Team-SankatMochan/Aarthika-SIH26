import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { formatINR } from '../engine/financeCalculator';

export default class Profile extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'profiles';

    @field('capital') capital!: number;
    @field('city_key') cityKey!: string;
    @field('business_type_key') businessTypeKey!: string;
    @field('city_name') cityName!: string;
    @field('business_label') businessLabel!: string;
    @field('tier') tier!: string;
    @readonly @date('created_at') createdAt!: number;

    // Validation
    isValid(): boolean {
        return (
            this.capital > 0 &&
            this.cityKey.length > 0 &&
            this.businessTypeKey.length > 0
        );
    }

    // Display formatting
    getDisplayCapital(): string {
        return formatINR(this.capital);
    }
}
