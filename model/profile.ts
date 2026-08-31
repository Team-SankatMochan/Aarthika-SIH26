import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Profile extends Model {
    static table = 'profiles';

    @field('capital') capital!: number;
    @field('city_key') cityKey!: string;
    @field('business_type_key') businessTypeKey!: string;
    @field('city_name') cityName!: string;
    @field('business_label') businessLabel!: string;
    @field('tier') tier!: string;
    @readonly @date('created_at') createdAt!: number;
}
