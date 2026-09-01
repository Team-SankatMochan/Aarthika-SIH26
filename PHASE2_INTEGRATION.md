# Phase 2 Backend Integration - Complete

## Summary

Successfully integrated the FastAPI backend (Phase 2) with the React Native frontend (Phase 1). The app now supports both offline-first local operation AND server synchronization when connectivity is available.

## What Was Integrated

### 1. Backend Setup ✅
- **Copied complete FastAPI backend** from SIH2026 to `backend/` directory
- **Docker Compose setup** for PostgreSQL + FastAPI service
- **13 REST API endpoints** for users, businesses, schemes, stress tests, pilots, evidence, decisions
- **WatermelonDB sync endpoint** at `POST /sync` with transactional, idempotent operations
- **Deterministic financial engine** in Python using Decimal arithmetic

### 2. Database Schema Migration ✅
**Updated from v1 to v2:**
- Added 14 new tables matching backend schema
- Kept legacy `profiles` and `interactions` tables for backward compatibility during migration
- Created migration file with proper schema versioning

**New Tables:**
- `locations` - Geographic data (state, district, block, village)
- `users` - Entrepreneur profiles (replaces profiles)
- `businesses` - Business ideas (linked to users and locations)
- `business_assumptions` - Financial projections with versioning
- `market_data` - Market observations and estimates
- `stress_tests` + `stress_test_scenarios` - Crash test simulations
- `pilots` + `pilot_results` - Real-world validation experiments
- `schemes` + `scheme_rules` - Government financing schemes
- `finance_assessments` - Loan calculations with moratorium interest
- `evidence` - Traceable proof points
- `decisions` - GO/MODIFY/DO_NOT_INVEST_YET recommendations

### 3. WatermelonDB Models Created ✅
Created 14 TypeScript model classes with:
- Proper decorators (`@field`, `@relation`, `@children`)
- Relationships defined (`belongs_to`, `has_many`)
- Helper methods (e.g., `monthlyRevenue`, `totalOperatingCost`)
- JSON parsing for metadata fields
- Type safety throughout

**Model Files:**
- `Location.ts`, `User.ts`, `Business.ts`
- `BusinessAssumption.ts`, `MarketData.ts`
- `StressTest.ts`, `StressTestScenario.ts`
- `Pilot.ts`, `PilotResult.ts`
- `Scheme.ts`, `SchemeRule.ts`
- `FinanceAssessment.ts`
- `Evidence.ts`, `Decision.ts`

### 4. Sync Implementation ✅
**File: `model/index.ts`**
- Implemented `syncDatabase()` using WatermelonDB's `synchronize()` API
- `pullChanges` - fetches server updates since `lastPulledAt`
- `pushChanges` - sends local changes to backend
- Auto-sync on app startup (2 second delay)
- Periodic sync every 5 minutes (configurable)
- Proper error handling and logging

### 5. Environment Configuration ✅
**File: `config/index.ts`**
- Platform-aware API URL detection
- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`
- Configurable sync interval and timeout
- `.env.example` with documentation

### 6. Input Screen Migration ✅
**Updated to create Phase 2 entities:**
- Creates `User` record with available capital
- Creates `Business` record linked to user and location
- Still creates legacy `Profile` for backward compatibility
- Passes business ID to dashboard

### 7. Dashboard Screen Updates ✅
**Hybrid model support:**
- Accepts both `Business + User` (new) OR `Profile` (legacy)
- Maps backend models to math engine inputs
- Observes both tables simultaneously with RxJS operators
- Graceful fallback if one table doesn't have the record

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ React Native App (Expo SDK 57)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input Screen  ──┐                                           │
│                  │                                           │
│                  ├──> WatermelonDB (SQLite)                  │
│  Dashboard  ────┤         │                                  │
│                  │         │  models/index.ts                │
│                  │         │  syncDatabase()                 │
│                  │         │                                  │
│                  │         ├──> POST /sync                   │
│                  │         │    (push local changes)         │
│                  │         │                                  │
│                  │         ├──> GET /sync?lastPulledAt=...   │
│                  │         │    (pull server changes)        │
│                  │         │                                  │
│                  │         v                                  │
│                  │    ┌──────────────────────────┐          │
│                  └───>│   Deterministic Engine    │          │
│                       │   (TypeScript)            │          │
│                       │   - 50+ cities            │          │
│                       │   - 17 business types     │          │
│                       │   - Risk calculations     │          │
│                       └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP (Expo fetch)
                               │
                               v
┌─────────────────────────────────────────────────────────────┐
│ FastAPI Backend (Python 3.12)                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  POST /sync  ──> SyncService ──> SQLAlchemy ORM             │
│                       │                │                      │
│                       │                v                      │
│  GET /businesses      │         PostgreSQL 16                │
│  POST /stress-tests   │         (Relational DB)             │
│  GET /schemes         │                                      │
│  POST /finance-assessment                                    │
│                       │                                      │
│                       v                                      │
│                 FinanceService                               │
│                 (Decimal arithmetic)                         │
│                 - Moratorium interest                        │
│                 - EMI calculation                            │
│                 - Debt affordability                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Testing Instructions

### 1. Start the Backend

```bash
cd backend

# Option A: Using Docker Compose (Recommended)
cd ..
docker-compose up --build

# Option B: Local development with uv
uv run alembic upgrade head
uv run python scripts/seed_database.py
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 2. Configure Mobile App

Create `.env` file in project root:
```bash
# For Android emulator
API_URL=http://10.0.2.2:8000

# For iOS simulator
# API_URL=http://localhost:8000

# For physical device on same network
# API_URL=http://192.168.1.100:8000
```

### 3. Build & Run Mobile App

```bash
# Install dependencies (if not done)
npm install

# Start Expo development server
npx expo start --dev-client

# Press 'a' for Android or 'i' for iOS
```

### 4. Test Offline-First Flow

1. **Without backend running:**
   - Enter margin capital: ₹50,000
   - Select city: Jaipur (Tier 2)
   - Select business: Kirana / Grocery
   - Submit → Dashboard loads instantly ✅
   - All calculations work offline ✅

2. **Start backend, wait 2 seconds:**
   - Check terminal logs for "Sync completed successfully"
   - Backend should receive the created user and business

3. **Check PostgreSQL:**
   ```bash
   docker exec -it arthsetu_postgres psql -U arthsetu_user -d arthsetu_db
   
   SELECT * FROM users;
   SELECT * FROM businesses;
   ```

4. **Test Sync Push:**
   - Create another business in the app
   - Wait 2-10 seconds (initial sync delay)
   - Check backend logs for sync request
   - Verify data in PostgreSQL

### 5. Test Sync Pull

From backend (using httpie or curl):
```bash
# Create a new scheme on backend
curl -X POST http://localhost:8000/schemes \
  -H "Content-Type: application/json" \
  -d '{
    "scheme_name": "Rural Micro Enterprise Scheme",
    "scheme_type": "government",
    "description": "Special scheme for rural entrepreneurs",
    "active": true
  }'

# Wait for next sync cycle (up to 5 minutes) or restart app
# App should pull the new scheme into local database
```

### 6. Verify Data Integrity

**Check WatermelonDB:**
```javascript
// In React Native debugger console
import { database } from './model';

// Count records
const users = await database.get('users').query().fetch();
console.log('Users:', users.length);

const businesses = await database.get('businesses').query().fetch();
console.log('Businesses:', businesses.length);

// Check sync works
import { syncDatabase } from './model';
await syncDatabase();
```

## Backend API Endpoints Available

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Check API and DB health |
| POST | `/sync` | WatermelonDB synchronization |
| POST | `/users` | Create entrepreneur profile |
| GET | `/users` | List all users |
| POST | `/businesses` | Register business idea |
| GET | `/businesses` | List businesses |
| POST | `/businesses/{id}/assumptions` | Add financial projections |
| POST | `/businesses/{id}/stress-tests` | Run crash test scenarios |
| GET | `/stress-tests/{id}` | Get stress test results |
| POST | `/businesses/{id}/pilots` | Plan real-world pilot |
| POST | `/pilots/{id}/results` | Record pilot outcomes |
| GET | `/schemes` | List financing schemes |
| POST | `/businesses/{id}/finance-assessment` | Calculate loan recommendations |
| POST | `/businesses/{id}/evidence` | Attach proof points |
| POST | `/businesses/{id}/decision` | Generate GO/NO-GO decision |

Full API documentation: http://localhost:8000/docs

## Key Features Implemented

### Offline-First ✅
- All CRUD operations work without network
- Math engine calculations run locally
- Dashboard fully functional offline
- Data persists in SQLite

### Sync When Online ✅
- Automatic push of local changes
- Pull of server updates
- Idempotent operations (no duplicates)
- Transactional (all-or-nothing)
- Topological ordering (respects foreign keys)

### Data Migration ✅
- Backward compatible with Phase 1
- New entities (User, Business) created alongside legacy Profile
- Dashboard works with both old and new models
- Smooth transition path

### Type Safety ✅
- All models properly typed
- No TypeScript compilation errors
- Relationship types defined
- Helper methods with return types

## Configuration Files

### `docker-compose.yml`
- PostgreSQL 16 service
- FastAPI service
- Health checks
- Volume persistence

### `backend/.env.example`
```
POSTGRES_USER=arthsetu_user
POSTGRES_PASSWORD=arthsetu_password
POSTGRES_DB=arthsetu_db
DATABASE_URL=postgresql://arthsetu_user:arthsetu_password@localhost:5432/arthsetu_db
```

### Mobile `.env`
```
API_URL=http://10.0.2.2:8000
```

### `config/index.ts`
```typescript
{
  apiUrl: 'http://10.0.2.2:8000',  // Auto-detected per platform
  syncEnabled: true,
  syncInterval: 300000,  // 5 minutes
  offlineTimeout: 30000,  // 30 seconds
}
```

## What Phase 3 and 4 Will Add

**Phase 3 (Background Jobs):**
- Redis caching
- Celery task queue
- Async stress test execution
- Scheduled scheme updates

**Phase 4 (Multi-Agent AI):**
- pgvector for embeddings
- LangGraph orchestration
- Market Analyst agent
- Risk Actuary agent
- Azure OpenAI / AWS Bedrock
- Personalized recommendations

## Troubleshooting

### Sync Not Working
1. Check backend is running: `curl http://localhost:8000/health`
2. Check API_URL in config matches backend
3. For Android emulator, use `10.0.2.2` not `localhost`
4. Check terminal logs for sync errors
5. Verify network permissions in app.json

### Database Migration Issues
```bash
# Reset local database (WARNING: deletes all data)
# Android
adb shell run-as com.anonymous.aarthika rm -rf databases/

# iOS
# Delete app from simulator and reinstall
```

### Backend Database Issues
```bash
# Reset PostgreSQL
docker-compose down -v
docker-compose up --build

# Re-run migrations
docker exec -it arthsetu_api uv run alembic upgrade head
docker exec -it arthsetu_api uv run python scripts/seed_database.py
```

## Files Changed/Created

### Created (28 files):
- `backend/` (entire directory from SIH2026)
- `docker-compose.yml`
- `config/index.ts`
- `.env.example`
- `model/migrations.ts`
- `model/Location.ts`
- `model/User.ts`
- `model/Business.ts`
- `model/BusinessAssumption.ts`
- `model/MarketData.ts`
- `model/StressTest.ts`
- `model/StressTestScenario.ts`
- `model/Pilot.ts`
- `model/PilotResult.ts`
- `model/Scheme.ts`
- `model/SchemeRule.ts`
- `model/FinanceAssessment.ts`
- `model/Evidence.ts`
- `model/Decision.ts`

### Modified (3 files):
- `model/schema.ts` - v1 → v2 with 14 new tables
- `model/index.ts` - Added sync implementation
- `src/app/index.tsx` - Create User + Business entities
- `src/app/dashboard.tsx` - Support both Profile and Business models

## Next Steps

1. **Test thoroughly** with backend running
2. **Migrate existing profiles** to users/businesses (write migration script if needed)
3. **Add UI for new features**:
   - Stress test screen
   - Pilot tracking screen
   - Scheme browser
   - Evidence attachment
   - Decision summary
4. **Enhance sync**:
   - Add conflict resolution
   - Add sync status indicator in UI
   - Add manual sync button
5. **Prepare for Phase 3** (your partner can now continue)

---

**Status**: ✅ Phase 2 backend fully integrated with Phase 1 frontend. Ready for testing and Phase 3/4 development.
