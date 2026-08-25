# KrishiNexus — Hybrid RAG Architecture & Dual-Cluster Guide

## 1. Overview & Architecture Motivation

KrishiNexus V2 uses **Hybrid RAG** (combining **Atlas Vector Search** for semantic matching + **Atlas Full-Text Search** for exact keyword/variety code matching via MongoDB `$rankFusion`).

### The M0 Index Limit & The 2-Cluster Solution
MongoDB Atlas Free Tier (M0) enforces a strict limit of **maximum 3 Search / Vector Search indexes per cluster**. 

To support our 4 required search indexes without paying for a dedicated M10 tier, the application uses a **Dual-Cluster Architecture**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 KRISHINEXUS BACKEND                                     │
│                                                                                         │
│   ┌────────────────────────────────┐            ┌───────────────────────────────────┐   │
│   │   Primary Cluster 1 (getDb)    │            │   Search Cluster 2 (getSearchDb)  │   │
│   │      (env: MONGO_URI)          │            │     (env: MONGO_URI_SEARCH)       │   │
│   ├────────────────────────────────┤            ├───────────────────────────────────┤   │
│   │ • districts, upazilas, users   │            │ • regional_advisories (copy)      │   │
│   │ • raw_bulletins, raw_diseases  │            │                                   │   │
│   │ • market_prices, alert_records │            │ Search Indexes (2 of 3 used):     │   │
│   │ • warehouse_stocks, dispatches │            │  1. 'embedding' (vectorSearch)    │   │
│   │ • crop_pathology, thresholds   │            │  2. 'advisory_text_index' (text)  │   │
│   │                                │            └───────────────────────────────────┘   │
│   │ Vector Indexes (2 of 3 used):  │                                                    │
│   │  1. 'embedding' (pathology)    │                                                    │
│   │  2. 'embedding' (thresholds)   │                                                    │
│   └────────────────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Data Flow

### A. Query-Time Flow (`POST /api/rag/query`)

```
[ User / Extension Officer Query ] (e.g., "ব্রি ধান ৮৭ চাষ পদ্ধতি ও সার প্রয়োগ")
                     │
                     ▼
         1. Embed Query with Gemini (embedding-001)
                     │
                     ▼
         2. Parallel Retrieval (Promise.all):
            ├── Cluster 2: searchAdvisories(queryVector, question, k=5, districtId, useHybrid=true)
            │      └── Executes native MongoDB $rankFusion:
            │             • 60% weight: Vector Search on 'embedding'
            │             • 40% weight: BM25 Text Search on 'advisory_text_index'
            │             • Automatic fallback to Node.js RRF if $rankFusion unavailable
            ├── Cluster 1: vectorSearch('crop_pathology', queryVector, k=5)
            ├── Cluster 1: vectorSearch('crop_thresholds', queryVector, k=2)
            ├── Cluster 1: findOne('districts', { _id: districtId })  [Live Weather + Alerts]
            └── Cluster 1: findOne('raw_bulletins', { zilaId })      [Official BAMIS Bulletin]
                     │
                     ▼
         3. Prompt Assembly (Bulletin FIRST, then hybrid context, weather, alerts)
                     │
                     ▼
         4. Gemini 2.5 Flash Generation (temperature: 0.3)
                     │
                     ▼
         5. Response + Metadata returned to Client
```

---

## 3. Developer Guide: How to Write Backend Code & New Features

### Rule #1: All Standard Features Use `getDb()` (Primary Cluster)
When creating new routes, models, or services (e.g., Auth, Logistics, Upazilas, Market Prices, Alert Records, Reports, Analytics):
- **Always import `getDb` from `../db/connect`**
- You do **NOT** need to think about Cluster 2 for standard CRUD operations.

```javascript
// Example in any standard route or service:
const { getDb } = require('../db/connect');

async function getMarketTrends(districtId) {
  const db = getDb(); // ← Connects to Primary Cluster 1
  return await db.collection('market_prices').find({ districtId }).toArray();
}
```

### Rule #2: `getSearchDb()` is Isolated to Advisory Retrieval
`getSearchDb()` is used exclusively inside `backend/services/vectorSearch.js` for `regional_advisories`.

```javascript
const { getDb, getSearchDb } = require('../db/connect');

// Primary database (Cluster 1)
const primaryDb = getDb();

// Search database (Cluster 2) with automatic fallback to Primary Cluster if not configured
const searchDb = getSearchDb();
```

---

## 4. Backend & Ingestion Considerations (Future Ingestion & Data Sync)

| Component / File | Purpose | Impact & Maintenance Notes |
|---|---|---|
| `backend/db/connect.js` | Dual DB Connection Manager | Initializes both `MONGO_URI` (primary) and `MONGO_URI_SEARCH` (search). If `MONGO_URI_SEARCH` is omitted or unavailable, it gracefully defaults `searchDb` to `db`. |
| `backend/services/vectorSearch.js` | Retrieval & Ranking Engine | Executes `$rankFusion` on `searchDb`, with built-in Node.js Reciprocal Rank Fusion (RRF) fallback. |
| `backend/routes/rag.js` | RAG Query Endpoint | Accepts `useHybrid` parameter (defaults `false` or toggleable) and returns `searchMode` in metadata. |
| `backend-ingestion/cron/weatherRefresh.js` | 6-hour weather cron | **No effect** — operates 100% on Primary Cluster (`districts` & `upazilas`). |
| `backend-ingestion/ingestion/embedAndStore.js` | BAMIS Bulletin Parser & Embedder | **Critical for Future Sync:** When re-running the bulletin scraper/embedder to populate new `regional_advisories`, run `node backend/scripts/copy_to_cluster2.js` to sync the new advisory documents to Cluster 2. |
| `backend/scripts/copy_to_cluster2.js` | One-click Sync Utility | Batch copies `regional_advisories` from Cluster 1 to Cluster 2 and verifies document count parity. |

---

## 5. Production Deployment (Render / Vercel / Docker)

### Environment Variables Matrix

| Variable | Location | Local Dev Value | Production Value | Purpose |
|---|---|---|---|---|
| `MONGO_URI` | `backend/.env` | `mongodb+srv://.../agri_data` | Primary Atlas Cluster URI | Primary DB (all collections) |
| `MONGO_URI_SEARCH` | `backend/.env` | `mongodb+srv://.../agri_data` | Cluster 2 Atlas URI | Dedicated Search Cluster for Hybrid RAG |
| `GEMINI_API_KEY` | `backend/.env` | `AQ.Ab8...` | Gemini API Key | Embedding & Generation |
| `PORT` | `backend/.env` | `5001` | `5001` | Express Port |
| `JWT_SECRET` | `backend/.env` | `2e02b93...` | Same as `backend-auth` | Local JWT verification |

### Production Deployment Steps (e.g. on Render)
1. Add both `MONGO_URI` and `MONGO_URI_SEARCH` to the Render Environment Variables for the backend API service.
2. If `MONGO_URI_SEARCH` is omitted during staging or testing, the backend will automatically and safely fall back to pure vector search on `MONGO_URI` without crashing.

---

## 6. Verification Scripts

To test or debug search anytime:
1. **Benchmark Search Comparison**:
   ```bash
   node backend/scripts/test_hybrid_rag.js
   ```
   *Runs 5 test queries comparing `useHybrid: false` vs `useHybrid: true`.*

2. **End-to-End RAG Query**:
   ```bash
   node backend/scripts/test_rag_endpoint.js
   ```
   *Spins up a test instance and tests Gemini generation on Bengali query.*

3. **Data Sync**:
   ```bash
   node backend/scripts/copy_to_cluster2.js
   ```
   *Copies and verifies `regional_advisories` count between Cluster 1 and Cluster 2.*
