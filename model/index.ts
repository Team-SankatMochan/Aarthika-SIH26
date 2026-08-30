import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Profile from './profile';
import Interaction from './Interaction';

const adapter = new SQLiteAdapter({ schema });

export const database = new Database({
    adapter,
    modelClasses: [Profile, Interaction],
});