import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Profile extends Model {
    static table = 'profiles';

    @field('capital') capital!: number;
    @field('location') location!: string;
    @field('business_type') businessType!: string;
    @readonly @date('created_at') createdAt!: number;
}