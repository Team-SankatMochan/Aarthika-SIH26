import { tableSchema, appSchema } from '@nozbe/watermelondb';

export default appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'profiles',
            columns: [
                { name: 'capital', type: 'number' },
                { name: 'city_key', type: 'string' },
                { name: 'business_type_key', type: 'string' },
                { name: 'city_name', type: 'string' },
                { name: 'business_label', type: 'string' },
                { name: 'tier', type: 'string' },
                { name: 'created_at', type: 'number' },
            ],
        }),

        tableSchema({
            name: 'interactions',
            columns: [
                { name: 'profile_id', type: 'string', isIndexed: true },
                { name: 'slider_name', type: 'string' },
                { name: 'slider_value', type: 'number' },
                { name: 'timestamp', type: 'number' },
            ],
        }),
    ],
});
