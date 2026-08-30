# Aarthika

**Offline-first mobile financial planning for rural users with unreliable connectivity.**

Built for Smart India Hackathon 2026 — Problem Statement **SIH26091** — by **Team Sankatmochan**.

---

## The Problem

Rural entrepreneurs and small business owners often need to plan financing, loans, and margin capital decisions in areas with 0 Mbps connectivity. Existing financial planning tools assume an always-on connection. Aarthika works entirely on-device — no signal, no spinner, no "check your connection" error — and syncs to the cloud only when a connection becomes available.

## Phase 1 Scope: The Offline-First Frontend

This phase delivers a fully functional local experience:

- **Input screen** — capture margin capital, location, and business type
- **Local, on-device database** — every entry persists instantly, with zero network dependency
- **TypeScript math engine** — pure functions computing project cost and EMI from the same formulas used in the underlying financial model
- **Interactive Dashboard** — a disaster-impact slider and a Go/No-Go gauge that recalculate live, entirely offline, as the user drags

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React Native (Expo, SDK 57) | Single codebase, Android + iOS |
| Routing | Expo Router (file-based) | Default in current Expo templates |
| Local storage | WatermelonDB | Built-in sync engine — this app's core differentiator is syncing local changes to a backend once connectivity returns |
| Language | TypeScript | Type-safety for the financial calculation layer especially |
| UI | React Native core components + `react-native-svg` | Custom-drawn gauge, no unmaintained charting deps |

## Architecture

```
Input screen  →  Local database  →  Math engine  →  Dashboard
  (Screen A)      (WatermelonDB)    (financials.ts)   (sliders, gauge)
                                          ↑                  │
                                          └──────────────────┘
                                   recalculates instantly, offline
```

Every write to the local database is logged in a sync-ready shape. Phase 2 connects this to a FastAPI backend (with a LangGraph multi-agent layer) via WatermelonDB's `synchronize()` pull/push protocol — no rewrite needed, just pointing the existing local writes at a real endpoint.

## Project Structure

```
aarthika/
├── babel.config.js
├── package.json
├── model/
│   ├── schema.ts        # table definitions (profiles, interactions)
│   ├── Profile.ts        # model class for a saved user profile
│   ├── Interaction.ts     # model class for slider engagement logging
│   └── index.ts          # Database + SQLiteAdapter setup
├── engine/
│   └── financials.ts      # pure calculation functions (no dependencies)
├── components/
│   └── GoNoGoGauge.tsx     # hand-rolled SVG semicircle gauge
└── src/app/
    ├── _layout.tsx         # root layout, wraps app in DatabaseProvider + Stack
    ├── index.tsx           # Input screen (route: /)
    └── dashboard.tsx        # Dashboard screen (route: /dashboard)
```

## Getting Started

**Prerequisites:** Node.js, an Android phone with USB debugging enabled (or emulator), an [EAS](https://expo.dev/eas) account.

WatermelonDB requires native code, so this app **cannot run in Expo Go** — you need a custom development client.

```bash
npm install
npx eas login
eas build:configure
eas build --profile development --platform android
```

Install the resulting build on your device, then:

```bash
npx expo start --dev-client
```

Press `a` to launch on a connected Android device, or scan the QR code.

## Known Issues

- **"Cannot assign to read-only property 'NONE'"** — this is an upstream React Native bug ([facebook/react-native#54732](https://github.com/facebook/react-native/issues/54732)), not a bug in this project. RN's internal `Event.js` defines phase constants as non-writable, which breaks under certain native event handling (observed here on the Android hardware back button). No clean fix exists upstream yet; the app continues to function normally underneath the error overlay.

## Roadmap

- [x] Phase 1 — Offline-first local data entry, calculation, and interactive dashboard
- [ ] Phase 2 — FastAPI backend + `synchronize()` sync integration
- [ ] Phase 3 — LangGraph multi-agent layer for personalized guidance

## Team

**Team Sankatmochan** — SIH 2026, Problem Statement SIH26091
