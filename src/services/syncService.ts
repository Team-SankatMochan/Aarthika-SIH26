import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../../model';
import * as Crypto from 'expo-crypto';

/**
 * Resolve sync base URL dynamically from environment, extra config, or local dev host.
 */
export function getSyncBaseUrl(): string | undefined {
    // 1. Explicit env var (process.env.EXPO_PUBLIC_API_URL or process.env.API_URL)
    const envUrl = (typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_API_URL || process.env.API_URL) : undefined)
        || Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;

    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
        return envUrl.trim();
    }

    // In unit tests, do not use dev fallbacks if env is explicitly unset
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        return undefined;
    }

    // 2. In local development (__DEV__), automatically resolve local backend
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    if (isDev) {
        if (Platform.OS === 'android') {
            const hostUri = Constants.expoConfig?.hostUri;
            if (hostUri) {
                const host = hostUri.split(':')[0];
                return `http://${host}:8000`;
            }
            return 'http://10.0.2.2:8000';
        }
        return 'http://localhost:8000';
    }

    return undefined;
}

/**
 * In-memory pending push request ID.
 * Persists across retries of the same push batch within the same app session.
 * Reset to null after successful push confirmation.
 */
let pendingPushRequestId: string | null = null;

export class SyncDisabledError extends Error {
    constructor() {
        super('Remote sync is disabled: EXPO_PUBLIC_API_URL is not configured. Offline operation continues.');
        this.name = 'SyncDisabledError';
    }
}

export class SyncConflictError extends Error {
    public conflicts: any[];
    constructor(conflicts: any[]) {
        super(`Sync push produced ${conflicts.length} conflict(s). Local changes retained.`);
        this.name = 'SyncConflictError';
        this.conflicts = conflicts;
    }
}

export async function syncData() {
    const baseUrl = getSyncBaseUrl();
    if (!baseUrl) {
        console.warn('[Sync] EXPO_PUBLIC_API_URL not configured. Remote sync disabled.');
        throw new SyncDisabledError();
    }

    const SYNC_URL = `${baseUrl}/api/v1/sync`;

    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            // Pull uses its own unique request ID — never shares with push
            const pullRequestId = Crypto.randomUUID();

            const response = await fetch(SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sync_request_id: pullRequestId,
                    lastPulledAt,
                    changes: {
                        businesses: { created: [], updated: [], deleted: [] },
                        business_assumptions: { created: [], updated: [], deleted: [] },
                        finance_assessments: { created: [], updated: [], deleted: [] },
                        decisions: { created: [], updated: [], deleted: [] },
                        evidence: { created: [], updated: [], deleted: [] },
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`[Sync] Pull failed: ${response.status} ${response.statusText}`);
            }

            const { changes, timestamp } = await response.json();

            // Map backend sync_revision → local server_revision
            for (const table of Object.keys(changes || {})) {
                for (const op of ['created', 'updated']) {
                    if (changes[table]?.[op]) {
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
            // Reuse pending push request ID for retry safety.
            // Only generate a new ID for a genuinely new push batch.
            if (!pendingPushRequestId) {
                pendingPushRequestId = Crypto.randomUUID();
            }

            // Map local server_revision → base_server_revision for backend OCC
            const changesAny = changes as any;
            for (const table of Object.keys(changesAny)) {
                for (const op of ['created', 'updated']) {
                    if (changesAny[table]?.[op]) {
                        for (const record of changesAny[table][op]) {
                            if (record.server_revision !== undefined) {
                                record.base_server_revision = record.server_revision;
                                delete record.server_revision;
                            }
                        }
                    }
                }
            }

            const response = await fetch(SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sync_request_id: pendingPushRequestId,
                    lastPulledAt,
                    changes,
                }),
            });

            if (!response.ok) {
                const resText = await response.text();
                // Do NOT clear pendingPushRequestId — retry should reuse the same ID
                throw new Error(`[Sync] Push failed: ${response.status} - ${resText}`);
            }

            // Parse response and check for conflicts
            const responseBody = await response.json();
            const conflicts = responseBody?.conflicts;

            if (conflicts && Array.isArray(conflicts) && conflicts.length > 0) {
                // Backend rolled back the entire push. Local changes are retained.
                // Do NOT clear pendingPushRequestId — the push was not committed.
                throw new SyncConflictError(conflicts);
            }

            // Push was fully successful — clear pending ID so next push gets a new one
            pendingPushRequestId = null;
        },
        migrationsEnabledAtVersion: 1,
    });
}

/**
 * Expose for testing: get the current pending push request ID.
 */
export function getPendingPushRequestId(): string | null {
    return pendingPushRequestId;
}

/**
 * Expose for testing: reset the pending push request ID.
 */
export function resetPendingPushRequestId(): void {
    pendingPushRequestId = null;
}
