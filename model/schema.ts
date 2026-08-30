import { tableSchema, appSchema } from '@nozbe/watermelondb';
export default appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'profiles',
            columns: [
                { name: 'capital', type: 'number' },
                { name: 'location', type: 'string' },
                { name: 'business_type', type: 'string' },
                { name: 'created_at', type: 'number' },
            ],
        }),

        tableSchema({
            name: 'interactions',
            columns: [
                { name: 'profile_id', type: 'string', isIndexed: true },
                { name: 'slider_name', type: 'string' },
                { name: 'moved_count', type: 'number' },
            ],
        }),
    ],
});