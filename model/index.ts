import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

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

// Create adapter with error resilience
let adapter: SQLiteAdapter;
try {
    adapter = new SQLiteAdapter({
        schema,
        migrations,
        jsi: true,
        onSetUpError: (error) => {
            console.error('Database setup error:', error);
        },
    });
} catch (error) {
    console.error('Failed to create SQLiteAdapter:', error);
    // Create a minimal adapter without migrations as fallback
    adapter = new SQLiteAdapter({
        schema,
        jsi: true,
        onSetUpError: (err) => {
            console.error('Database fallback setup error:', err);
        },
    });
}

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
