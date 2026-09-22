import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../../model';

export async function syncData() {
    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            const urlParams = lastPulledAt ? `?lastPulledAt=${lastPulledAt}` : '';
            const response = await fetch(`http://localhost:8000/api/sync/pull${urlParams}`);
            if (!response.ok) {
                throw new Error(`[Sync] Pull failed: ${response.statusText}`);
            }

            const { changes, timestamp } = await response.json();
            
            // Map sync_revision to server_revision
            for (const table of Object.keys(changes)) {
                for (const op of ['created', 'updated']) {
                    if (changes[table][op]) {
                        for (const record of changes[table][op]) {
                            if (record.sync_revision !== undefined) {
                                record.server_revision = record.sync_revision;
                                delete record.sync_revision;
                            }
                        }
                    }
                }
            }
            
            return { changes, timestamp };
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
            // Map server_revision to base_server_revision for backend
            const changesAny = changes as any;
            for (const table of Object.keys(changesAny)) {
                for (const op of ['created', 'updated']) {
                    if (changesAny[table][op]) {
                        for (const record of changesAny[table][op]) {
                            if (record.server_revision !== undefined) {
                                record.base_server_revision = record.server_revision;
                                delete record.server_revision;
                            }
                        }
                    }
                }
            }

            const response = await fetch(`http://localhost:8000/api/sync/push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ changes, lastPulledAt }),
            });
            if (!response.ok) {
                throw new Error(`[Sync] Push failed: ${response.statusText}`);
            }
        },
        migrationsEnabledAtVersion: 1,
    });
}
