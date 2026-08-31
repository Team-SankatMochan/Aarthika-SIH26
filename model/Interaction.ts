import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Interaction extends Model {
    static table = 'interactions';

    @field('profile_id') profileId!: string;
    @field('slider_name') sliderName!: string;
    @field('slider_value') sliderValue!: number;
    @date('timestamp') timestamp!: number;
}
