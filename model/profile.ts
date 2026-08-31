import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { formatINR, type ProjectInputs } from '../engine/financials';

export default class Profile extends Model {
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

    // Returns inputs for the financial engine
    getProjectInputs(): ProjectInputs {
        return {
            marginCapital: this.capital,
            cityKey: this.cityKey,
            businessTypeKey: this.businessTypeKey,
        };
    }
}
