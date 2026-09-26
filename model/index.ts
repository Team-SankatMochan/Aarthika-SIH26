import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

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

// Create adapter with error resilience and safe cross-platform fallback
function createSafeAdapter() {
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isWeb) {
        return new LokiJSAdapter({
            schema,
            migrations,
            useWebWorker: false,
            useIncrementalIndexedDB: true,
        });
    }

    try {
        // Use jsi: false to prevent "Cannot read property 'initializeJSI' of null"
        // when running in Expo Go or development client without custom JSI compilation
        return new SQLiteAdapter({
            schema,
            migrations,
            jsi: false,
            onSetUpError: (error) => {
                console.warn('Database setup warning:', error);
            },
        });
    } catch (error) {
        console.warn('SQLiteAdapter creation failed, using LokiJSAdapter fallback:', error);
        try {
            return new LokiJSAdapter({
                schema,
                useWebWorker: false,
            });
        } catch (err) {
            console.warn('LokiJS fallback failed, using minimal memory adapter:', err);
            return new LokiJSAdapter({ schema });
        }
    }
}

const adapter = createSafeAdapter();

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
