import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../../model';
import { v4 as uuidv4 } from 'uuid';

// Expect a configurable base URL, fallback to localhost for dev only if not set, but not hardcoded production.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export async function syncData() {
    const syncRequestId = uuidv4();
    
    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            const response = await fetch(`${BASE_URL}/api/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sync_request_id: syncRequestId,
                    lastPulledAt,
                    changes: {
                        businesses: { created: [], updated: [], deleted: [] },
                        business_assumptions: { created: [], updated: [], deleted: [] },
                        finance_assessments: { created: [], updated: [], deleted: [] },
                        decisions: { created: [], updated: [], deleted: [] },
                        evidence: { created: [], updated: [], deleted: [] }
                    }
                }),
            });
            
            if (!response.ok) {
                throw new Error(`[Sync] Pull failed: ${response.statusText}`);
            }

            const { changes, timestamp } = await response.json();
            
            // Map sync_revision to server_revision
            for (const table of Object.keys(changes || {})) {
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

            const response = await fetch(`${BASE_URL}/api/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sync_request_id: syncRequestId, 
                    lastPulledAt, 
                    changes 
                }),
            });
            if (!response.ok) {
                const resText = await response.text();
                // We should theoretically handle conflicts explicitly, 
                // but at minimum we throw so the app knows it failed.
                throw new Error(`[Sync] Push failed: ${response.status} - ${resText}`);
            }
        },
        migrationsEnabledAtVersion: 1,
    });
}
