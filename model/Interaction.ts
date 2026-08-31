import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import Profile from './profile';

export default class Interaction extends Model {
    static table = 'interactions';

    @field('profile_id') profileId!: string;
    @field('slider_name') sliderName!: string;
    @field('slider_value') sliderValue!: number;
    @date('timestamp') timestamp!: number;

    @relation('profiles', 'profile_id') profile!: Relation<Profile>;

    // Validation
    isValidSliderValue(): boolean {
        return this.sliderValue >= 0 && this.sliderValue <= 1;
    }
}
