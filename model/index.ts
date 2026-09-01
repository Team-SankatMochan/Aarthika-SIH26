import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { synchronize } from '@nozbe/watermelondb/sync';

import schema from './schema';
import migrations from './migrations';

// Import all models
import Profile from './profile';
import Interaction from './Interaction';
import Location from './Location';
import User from './User';
import Business from './Business';
import BusinessAssumption from './BusinessAssumption';
import MarketData from './MarketData';
import StressTest from './StressTest';
import StressTestScenario from './StressTestScenario';
import Pilot from './Pilot';
import PilotResult from './PilotResult';
import Scheme from './Scheme';
import SchemeRule from './SchemeRule';
import FinanceAssessment from './FinanceAssessment';
import Evidence from './Evidence';
import Decision from './Decision';

import config from '../config';

const adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: true, // Use JSI for better performance
    onSetUpError: (error) => {
        console.error('Database setup error:', error);
    },
});

export const database = new Database({
    adapter,
    modelClasses: [
        // Legacy models (for backward compatibility)
        Profile,
        Interaction,
        // Phase 2 models
        Location,
        User,
        Business,
        BusinessAssumption,
        MarketData,
        StressTest,
        StressTestScenario,
        Pilot,
        PilotResult,
        Scheme,
        SchemeRule,
        FinanceAssessment,
        Evidence,
        Decision,
    ],
});

// Sync function
export async function syncDatabase() {
    if (!config.syncEnabled) {
        console.log('Sync is disabled in config');
        return;
    }

    try {
        await synchronize({
            database,
            pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
                const response = await fetch(`${config.apiUrl}/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        lastPulledAt,
                        schemaVersion,
                        migration,
                        changes: {},
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Sync pull failed: ${response.statusText}`);
                }

                const { changes, timestamp } = await response.json();
                return { changes, timestamp };
            },
            pushChanges: async ({ changes, lastPulledAt }) => {
                const response = await fetch(`${config.apiUrl}/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        changes,
                        lastPulledAt,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Sync push failed: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`Sync completed: ${result.records_processed} records processed`);
            },
            migrationsEnabledAtVersion: 1,
        });

        console.log('Sync completed successfully');
    } catch (error) {
        console.error('Sync error:', error);
        throw error;
    }
}

// Auto-sync on app startup (with delay to allow connection)
let syncInterval: any = null;

export function startAutoSync() {
    if (!config.syncEnabled) {
        return;
    }

    // Initial sync after 2 seconds
    setTimeout(() => {
        syncDatabase().catch((err) => console.error('Initial sync failed:', err));
    }, 2000);

    // Set up periodic sync
    if (config.syncInterval > 0) {
        syncInterval = setInterval(() => {
            syncDatabase().catch((err) => console.error('Periodic sync failed:', err));
        }, config.syncInterval);
    }
}

export function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}
