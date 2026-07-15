# KrishiNexus — Full Project Specification
**Version:** 1.0  
**Competition Track:** Track B — Environment & Sustainability  
**Stack:** MERN (MongoDB Atlas + Express + React + Node.js)  
**AI:** Google Gemini API only (embedding + generation)  
**Deployment:** Vercel (frontend) + Render (backend) + MongoDB Atlas  

---

## Table of Contents
1. [Project Identity](#1-project-identity)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Repository Structure](#3-repository-structure)
4. [External Data Sources](#4-external-data-sources)
5. [Database Design](#5-database-design)
6. [Backend — Express API](#6-backend--express-api)
7. [RAG Pipeline — Detailed](#7-rag-pipeline--detailed)
8. [Frontend — React](#8-frontend--react)
9. [Page Specifications](#9-page-specifications)
10. [Deployment](#10-deployment)
11. [Environment Variables](#11-environment-variables)
12. [Build Order](#12-build-order)
13. [Assumptions & Open Questions](#13-assumptions--open-questions)

---

## 1. Project Identity

**Name:** KrishiNexus  
**Tagline:** Macro-Agricultural Supply Chain & Climate Resilience Control Room  
**Audience:** Agricultural extension offices, supply chain managers, and policymakers in Bangladesh  
**Problem:** Bangladesh's agricultural sector is exposed to sudden climate shocks (floods, drought, pest surges, salinity intrusion). No centralized, real-time dashboard exists for institutional decision-makers to monitor district-level risk, retrieve AI-generated advisories from official government knowledge bases, and simulate supply chain interventions before a crisis unfolds.  
**Solution:** A MERN web app that ingests live weather data (Open-Meteo), official agricultural bulletins and disease/threshold data (BAMIS), and historical crop production statistics (BBS), then surfaces them through a command-room UI with a RAG-powered AI advisory system backed by Gemini.

**Competition compliance note:** AI is central, not peripheral. The core AI component is a full RAG pipeline: scraped BAMIS government knowledge is parsed, chunked, embedded via Gemini's embedding API, stored in MongoDB Atlas with a vector index, retrieved via `$vectorSearch` at query time, and sent to Gemini's generation API with the user's question to produce grounded, district-specific agricultural advisories. The logistics page additionally calls Gemini to generate a structured AI shipping manifest on demand.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                       │
│  /          /dashboard              /logistics               │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│                  EXPRESS API (Render)                         │
│                                                              │
│  Scraper Services    Cron Jobs         API Routes            │
│  ─────────────────   ──────────────    ─────────────────     │
│  BAMIS bulletins     weather refresh   GET /districts        │
│  BAMIS diseases      risk scoring      GET /district/:id     │
│  BAMIS thresholds    ingestion run     POST /rag/query       │
│  Open-Meteo                            POST /logistics/...   │
│  bdapi                                 POST /manifest        │
└───────────┬──────────────┬────────────────────────────────┘
            │              │
┌───────────▼──┐    ┌──────▼───────────────────────────────┐
│  Gemini API  │    │         MongoDB Atlas                  │
│              │    │                                        │
│  Embedding   │    │  raw_bulletins                        │
│  Generation  │    │  raw_diseases                         │
└──────────────┘    │  raw_thresholds                       │
                    │  divisions                             │
                    │  districts  (+ liveWeather, risk)     │
                    │  regional_advisories  (+ embedding)   │
                    │  crop_pathology       (+ embedding)   │
                    │  crop_thresholds      (+ embedding)   │
                    │  market_production_baselines          │
                    │  warehouse_stocks  (seeded)           │
                    │  dispatch_records                     │
                    └───────────────────────────────────────┘
```

**Data flow summary:**
- **Ingestion (one-time + scheduled):** Scrapers pull from BAMIS/bdapi/Open-Meteo → raw collections. A separate processing script reads raw collections, builds chunks, calls Gemini embedding API, writes to RAG-ready collections.
- **Live weather refresh (cron, every 6 hours):** Pulls Open-Meteo for all 64 districts, updates `districts.liveWeather`, re-runs risk scoring, writes `riskStatus` and `activeAlerts`.
- **User query (per request):** Question → embed → `$vectorSearch` → top-k chunks → Gemini generation → stream response.

---

## 3. Repository Structure

```
krishinexus/
├── client/                        # React app (Vite)
│   ├── public/
│   │   └── bd-districts.geojson   # Bangladesh ADM2 GeoJSON (see §4.5)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── BangladeshMap.jsx
│   │   │   │   ├── DistrictTooltip.jsx
│   │   │   │   └── RiskLegend.jsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── LeftNav.jsx
│   │   │   │   ├── TelemetryPanel.jsx
│   │   │   │   ├── WeatherChart.jsx
│   │   │   │   ├── AlertBadges.jsx
│   │   │   │   ├── RagAdvisory.jsx
│   │   │   │   └── ChatTerminal.jsx
│   │   │   ├── Logistics/
│   │   │   │   ├── DeficitGrid.jsx
│   │   │   │   ├── LogisticsEngine.jsx
│   │   │    │   ├── WarehouseTable.jsx
│   │   │   │   └── SeveritySlider.jsx
│   │   │   └── Landing/
│   │   │       ├── Hero.jsx
│   │   │       ├── ProblemStats.jsx
│   │   │       ├── HowItWorks.jsx
│   │   │       └── FeatureCards.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── Logistics.jsx
│   │   ├── context/
│   │   │   └── AppContext.jsx      # global selectedDistrict state
│   │   ├── hooks/
│   │   │   ├── useDistricts.js
│   │   │   └── useRagQuery.js
│   │   ├── api/
│   │   │   └── index.js            # all axios calls centralised here
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                        # Express API
│   ├── routes/
│   │   ├── districts.js
│   │   ├── rag.js
│   │   ├── logistics.js
│   │   └── manifest.js
│   ├── services/
│   │   ├── geminiEmbed.js         # Gemini embedding API wrapper
│   │   ├── geminiGenerate.js      # Gemini generation API wrapper
│   │   ├── vectorSearch.js        # MongoDB $vectorSearch wrapper
│   │   ├── riskScorer.js          # compares liveWeather vs thresholds
│   │   └── weatherFetcher.js      # Open-Meteo fetch per district
│   ├── scrapers/
│   │   ├── scrapeBulletins.js
│   │   ├── scrapeDiseases.js
│   │   └── scrapeThresholds.js
│   ├── ingestion/
│   │   ├── parseBulletins.js      # raw → chunked regional_advisories
│   │   ├── parseDiseases.js       # raw → chunked crop_pathology
│   │   ├── parseThresholds.js     # raw → chunked crop_thresholds
│   │   ├── embedAndStore.js       # calls Gemini, writes embeddings
│   │   └── runIngestion.js        # master script: run all three
│   ├── cron/
│   │   ├── weatherRefresh.js
│   │   └── index.js
│   ├── db/
│   │   ├── connect.js
│   │   └── seeds/
│   │       └── warehouseStocks.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── app.js
│   ├── server.js
│   └── package.json
│
└── .env.example
```

---

## 4. External Data Sources

### 4.1 BAMIS — Bangladesh Agricultural Weather Information Service

**Base URL:** `https://www.bamis.gov.bd`

Three scraper endpoints (your existing Node.js scrapers on local ports):

| Data type | Your local endpoint | BAMIS URL pattern | ID range (approx) |
|---|---|---|---|
| Bulletins | `http://localhost:5001/api/fetch-bulletin/:zilaId` | `/bulletin/district/current/:zilaId` | 1–64 (BAMIS zila IDs) |
| Diseases | `http://localhost:5002/api/fetch-diseases/:diseaseId` | `/diseases/1/all/:diseaseId` | 1–150+ (per crop) |
| Thresholds | `http://localhost:5003/api/fetch-thresholds/:id` | `/thresholds/1/all/:id` | 1–100+ (per crop) |

**⚠️ CRITICAL — BAMIS zilaId vs bdapi district id mapping is NOT verified to be 1:1.**  
Before running ingestion, you must build a mapping table. Steps:
1. Fetch all 64 bulletins from BAMIS (zilaId 1–64).
2. Cross-check the district name in the returned `text` field (e.g. "জেলা: বরিশাল") against `bdapi /district` names.
3. Build a JSON lookup file: `{ "bamisZilaId": "22", "bdapiDistrictId": "???" }` for all 64.
4. Store this in `server/ingestion/zilaIdMap.json`.
5. All ingestion scripts use this map to set the correct `districtId` on every stored document.

Until this map is verified, `districtId` on advisory documents may point to the wrong district.

**Update: BAMIS zilaId vs bdapi district id mapping is verified. It is in backend/ingestion/zilaIdMap.json

### 4.2 bdapi — Bangladesh Administrative Data

**Base URL:** `https://bdapi.vercel.app/api/v.1`

| Endpoint | Returns | When to fetch |
|---|---|---|
| `/division` | 8 divisions with id, name, bn_name | Once, seed into `divisions` collection |
| `/district` | All 64 districts with id, division_id, lat, lon | Once, seed into `districts` collection |
| `/district/:divisionId` | Districts filtered by division | Not needed separately |

### 4.3 Open-Meteo — Live Weather

**URL pattern:**
```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max
  &timezone=Asia/Dhaka
  &forecast_days=7
```

- **Free, no API key required.**
- Called once per district per cron cycle (every 6 hours).
- Response stored in `districts.liveWeather` (not a separate collection — it's embedded in the district document for fast single-document reads on the frontend).
- Rate limit: 10,000 requests/day. Fetching all 64 districts = 64 requests per cron run × 4 runs/day = 256 requests/day. Well within limit.

### 4.4 BBS Kaggle Dataset — Crop Production

File: `bbs_crop_production.csv` (columns: Crop, District, Area (Acres), Production (M.Ton), Year)

- Not scraped — loaded once from the local CSV file.
- District name in BBS dataset (e.g. "Sylhet") must be mapped to bdapi district id (e.g. "35") during ingestion.
- Script: `server/ingestion/parseBBS.js` reads the CSV, resolves district names to ids, groups records by (district + crop), inserts into `market_production_baselines`.

### 4.5 Bangladesh ADM2 GeoJSON — District Boundaries for the Map

This is the boundary polygon file that `react-simple-maps` uses to draw each of the 64 districts.

**How to get it:**
1. Go to `https://geoboundaries.org/countryDownloads.html`
2. Search for **BGD** (Bangladesh)
3. Download **ADM2** level (this is district-level, not division or upazila)
4. You will get a `.geojson` file (may be named `geoBoundaries-BGD-ADM2.geojson`)
5. The file is large (~5MB). Simplify it using `mapshaper.org`:
   - Upload the file
   - In the console at the bottom type: `simplify 15% keep-shapes`
   - Export as GeoJSON
   - This reduces it to ~400KB without visibly affecting the district outlines
6. Save the simplified file as `client/public/bd-districts.geojson`

**Matching GeoJSON districts to your database districts:**  
Each feature in the GeoJSON will have a `properties` object. geoBoundaries uses `shapeName` for the English name and `shapeISO` for the ISO code. You need to match `shapeName` to bdapi district `name`. Some names will differ slightly (e.g. "Chittagong" vs "Chattagram"). Build a second mapping file `client/src/data/geoNameMap.json` to handle mismatches: `{ "Chittagong": "1", "Dhaka": "26" ... }` mapping GeoJSON shapeName to bdapi district id.

---

## 5. Database Design

**MongoDB Atlas cluster:** Free tier M0 is sufficient for competition.  
**Database name:** `krishinexus`

### 5.1 `divisions` collection

```json
{
  "_id": "1",
  "name": "Chattagram",
  "bnName": "চট্টগ্রাম",
  "url": "www.chittagongdiv.gov.bd"
}
```

64 documents total. Static — seeded once from bdapi. Not updated by any cron.

### 5.2 `districts` collection

This is the most-read collection. Frontend loads all 64 on dashboard mount for map coloring.

```json
{
  "_id": "1",
  "divisionId": "1",
  "bamisZilaId": "??",
  "name": "Comilla",
  "bnName": "কুমিল্লা",
  "lat": 23.4682747,
  "lon": 91.1788135,
  "url": "www.comilla.gov.bd",

  "liveWeather": {
    "fetchedAt": "2026-07-01T06:00:00.000Z",
    "tempMaxToday": 32.5,
    "tempMinToday": 26.4,
    "humidityMaxToday": 97,
    "precipitationSum7Day": [0.8, 0.8, 1.0, 1.1, 3.4, 2.1, 0.0],
    "tempMax7Day": [32.5, 33.5, 33.6, 33.7, 31.8, 30.2, 29.9],
    "forecastDates": ["2026-07-01", "2026-07-02", "..."]
  },

  "riskStatus": "yellow",
  "activeAlerts": [
    {
      "type": "pest",
      "label": "Red-Pumpkin Beetle Risk",
      "cropAffected": "Vegetables",
      "severity": "medium",
      "triggerReason": "Humidity 97% at 30°C matches beetle outbreak conditions"
    }
  ],

  "activeCrops": [
    { "crop": "Aman Rice", "stage": "Seedbed" },
    { "crop": "Vegetables", "stage": "Growth" }
  ]
}
```

`bamisZilaId` must be filled in from the verified mapping file (§4.1).  
`liveWeather`, `riskStatus`, `activeAlerts` are overwritten by the cron job (§6.4).  
`activeCrops` is populated by the bulletin ingestion pipeline (see §7.1) — the parser extracts which crops appear in the latest bulletin for that district.

### 5.3 `raw_bulletins` collection

Direct mirror of your scraper output. No processing. One document per district per scrape run.

```json
{
  "_id": "bulletin_22_20260701",
  "zilaId": "22",
  "sourceUrl": "https://www.bamis.gov.bd/bulletin/district/current/22",
  "bulletinNo": "742",
  "scrapedAt": "2026-07-01T00:00:00.000Z",
  "rawText": "আবহাওয়া ভিত্তিক কৃষি বিষয়ক বুলেটিন জেলা: বরিশাল ... (full text)",
  "length": 4575
}
```

### 5.4 `raw_diseases` collection

```json
{
  "_id": "disease_71",
  "diseaseId": "71",
  "sourceUrl": "https://www.bamis.gov.bd/diseases/1/all/71",
  "diseaseName": "পেয়ারা",
  "heading": "রোগ তথ্য - পেয়ারা",
  "featuredImage": "https://www.bamis.gov.bd/res/public/crops/2019/04/14/89.jpg",
  "images": [
    { "full": "...", "thumb": "..." }
  ],
  "sections": [
    { "title": "ক্যাঙ্কার রোগ", "text": "ক্যাঙ্কার রোগ" }
  ],
  "rawText": "ক্যাঙ্কার রোগ\nফল পচাঁ রোগ\n...",
  "scrapedAt": "2026-07-01T00:00:00.000Z",
  "length": 67
}
```

### 5.5 `raw_thresholds` collection

```json
{
  "_id": "threshold_58",
  "thresholdId": "58",
  "sourceUrl": "https://www.bamis.gov.bd/thresholds/1/all/58",
  "heading": "ফসল আবহাওয়া তথ্য - মসুর",
  "images": [ { "full": "...", "thumb": "..." } ],
  "rawText": "মশুর উৎপাদনের জন্য ঠান্ডা আবহাওয়া উপযোগী...",
  "scrapedAt": "2026-07-01T00:00:00.000Z",
  "length": 734
}
```

### 5.6 `regional_advisories` collection — RAG-ready

One document per crop-section per bulletin. Contains embedding. This is what `$vectorSearch` runs against.

```json
{
  "_id": "adv_22_742_0",
  "districtId": "22",
  "bulletinNo": "742",
  "publishDate": "2026-07-01T00:00:00.000Z",
  "sourceUrl": "https://www.bamis.gov.bd/bulletin/district/current/22",
  "crop": "Aman Rice",
  "stage": "Seedbed",
  "guidelineText": "আমন ধানের জমি তৈরির শেষ পর্যায়ে বিঘাপ্রতি ৯ কেজি ইউরিয়া প্রয়োগ করুন...",
  "ragContextChunk": "জেলা কোড: 22। ফসল: Aman Rice। পর্যায়: Seedbed। পরামর্শ: আমন ধানের জমি তৈরির...",
  "embedding": [ 0.012, -0.045, 0.781, "... 3072 floats total ..." ]
}
```

**Atlas Vector Index required on this collection:**
- Index name: `advisory_vector_index`
- Field: `embedding`
- Dimensions: `3072`
- Similarity: `cosine`

### 5.7 `crop_pathology` collection — RAG-ready

One document per disease section that has substantive text (skip stub entries where `title === text`).

```json
{
  "_id": "path_71_0",
  "sourceId": "71",
  "cropName": "পেয়ারা",
  "diseaseName": "ক্যাঙ্কার রোগ",
  "images": [ "https://www.bamis.gov.bd/res/public/crops/2019/04/14/89.jpg" ],
  "fullText": "ক্যাঙ্কার রোগ — অনুকূল আবহাওয়া: তাপমাত্রা ২৮-৩০° সে...",
  "ragContextChunk": "রোগের নাম: ক্যাঙ্কার রোগ। ফসল: পেয়ারা। অনুকূল আবহাওয়া: তাপমাত্রা...",
  "embedding": [ "... 3072 floats ..." ],
  "sourceUrl": "https://www.bamis.gov.bd/diseases/1/all/71"
}
```

**Atlas Vector Index required:**
- Index name: `pathology_vector_index`
- Field: `embedding`
- Dimensions: `3072`
- Similarity: `cosine`

### 5.8 `crop_thresholds` collection — RAG-ready + rule engine

```json
{
  "_id": "threshold_58",
  "sourceId": "58",
  "cropName": "মসুর",
  "heading": "ফসল আবহাওয়া তথ্য - মসুর",
  "ragContextChunk": "ফসল: মসুর। তথ্য: মশুর উৎপাদনের জন্য ঠান্ডা আবহাওয়া উপযোগী...",
  "embedding": [ "... 3072 floats ..." ],
  "sourceUrl": "https://www.bamis.gov.bd/thresholds/1/all/58",

  "parsedRules": {
    "germinationTempMin": 10,
    "germinationTempMax": 21.15,
    "germinationHumidityMin": 50,
    "germinationHumidityMax": 90,
    "floweringTempMin": 14,
    "floweringTempMax": 25,
    "floweringDisruptAbove": 32,
    "floweringHumidityMin": 45,
    "floweringHumidityMax": 75
  }
}
```

`parsedRules` is extracted by the threshold parser using regex against the rawText. These numeric fields are what the risk scorer (§6.4) compares against live weather — they are NOT used for vector search, they are used for deterministic rule-based flagging. Only `ragContextChunk` + `embedding` are used in the RAG query path.

**Atlas Vector Index required:**
- Index name: `threshold_vector_index`
- Field: `embedding`
- Dimensions: `3072`
- Similarity: `cosine`

### 5.9 `market_production_baselines` collection

```json
{
  "_id": "sylhet_onion",
  "districtId": "35",
  "crop": "Onion",
  "historicalRecords": [
    { "year": 2023, "areaAcres": 288, "yieldMtons": 910 },
    { "year": 2024, "areaAcres": 298.75, "yieldMtons": 1072.05 }
  ],
  "latestBaselineMtons": 1072.05,
  "latestYear": 2024
}
```

No embedding. Queried by district + crop for logistics calculations.

### 5.10 `warehouse_stocks` collection — seeded, simulated

```json
{
  "_id": "stock_dhaka_rice",
  "divisionId": "3",
  "divisionName": "Dhaka",
  "crop": "Rice",
  "reserveMtons": 45000,
  "lastUpdated": "2026-07-01T00:00:00.000Z",
  "isSimulated": true
}
```

Seeded once from `server/db/seeds/warehouseStocks.js`. UI displays a "SIMULATED DATA" badge on the warehouse table. Values are realistic-looking based on Bangladesh Food Directorate public reports.

Seed values (8 divisions × 10 crops = 80 documents including Rice, Wheat, Onion, Beans, Cabbage, Cauliflower, Garlic, Laushak, Radish, and Tomato):
reserves are programmatically seeded using base values per crop to ensure realistic quantities.

### 5.11 `dispatch_records` collection

```json
{
  "_id": "dispatch_20260701_001",
  "fromDivisionId": "3",
  "fromDivisionName": "Khulna",
  "toDistrictId": "22",
  "toDistrictName": "Barisal",
  "crop": "Rice",
  "cargoWeightMtons": 4000,
  "status": "dispatched",
  "climateSeverityFactorUsed": 0.25,
  "projectedDeficitMtons": 3800,
  "aiManifestText": "...",
  "createdAt": "2026-07-01T14:00:00.000Z"
}
```

Created when admin clicks "Approve & Route Supply Chain" on `/logistics`. `aiManifestText` is populated if admin clicked "Generate AI Shipping Manifest" before dispatching.

---

## 6. Backend — Express API

### 6.1 Setup

```
server/
├── app.js       # Express app, mounts routes, middleware
├── server.js    # Listens on PORT, connects DB, starts cron
```

```js
// app.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/districts', require('./routes/districts'));
app.use('/api/rag',       require('./routes/rag'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/manifest',  require('./routes/manifest'));

module.exports = app;
```

### 6.2 Routes

#### `GET /api/districts`

Returns all 64 districts with their current `riskStatus`, `activeAlerts`, `activeCrops`, and `liveWeather`. Called once on dashboard mount. Response is used to color the map and populate the left nav alert badges.

Fields returned: `_id, name, bnName, divisionId, lat, lon, riskStatus, activeAlerts, activeCrops, liveWeather`

Do NOT return `bamisZilaId` or internal mapping fields to the frontend.

#### `GET /api/districts/:id`

Returns one district's full detail. Called when user clicks a district on the map. Same fields as above.

#### `POST /api/rag/query`

The main RAG endpoint.

Request body:
```json
{
  "question": "What pest threats exist for vegetables in Barisal right now?",
  "districtId": "22",
  "language": "en"
}
```

Response: server-sent events (SSE) stream of Gemini's generated response, or a standard JSON response if streaming is not implemented in v1.

Logic (see §7 for full detail):
1. Embed the question via Gemini embedding API.
2. Run `$vectorSearch` on `regional_advisories` filtered to `districtId: "22"`, top 3 results.
3. Run `$vectorSearch` on `crop_pathology`, top 2 results (no district filter — diseases are not district-specific).
4. Run `$vectorSearch` on `crop_thresholds`, top 2 results (no district filter).
5. Fetch the current `liveWeather` for district 22 from `districts` collection.
6. Build prompt (see §7.3).
7. Call Gemini generation API.
8. Return response.

#### `POST /api/logistics/calculate`

Request body:
```json
{
  "districtId": "22",
  "crop": "Rice",
  "severityFactor": 0.25
}
```

Logic:
1. Fetch `market_production_baselines` for district 22 + crop Rice → `baselineMtons`.
2. `projectedDeficit = baselineMtons × severityFactor`
3. Find best surplus division: query `warehouse_stocks`, exclude district's own division, calculate distance for each option, and score them using an efficiency ratio: `reserveMtons / distanceKm` (highest efficiency ratio wins).
4. Distance calculation: Haversine formula using lat/lon from `districts` and the surplus division's centroid (hardcode division centroids — 8 values, see §13 assumptions).
5. Return: `{ baselineMtons, projectedDeficit, surplusDivision, surplusDivisionReserve, distanceKm, recommendedCargo }`

`recommendedCargo = Math.min(projectedDeficit × 1.05, surplusDivisionReserve × 0.3)` — 5% buffer, capped at 30% of surplus reserve so one district doesn't drain another.

#### `POST /api/logistics/dispatch`

Request body:
```json
{
  "fromDivisionId": "3",
  "toDistrictId": "22",
  "crop": "Rice",
  "cargoWeightMtons": 4000,
  "severityFactor": 0.25,
  "projectedDeficit": 3800,
  "aiManifestText": "..."
}
```

Creates a `dispatch_records` document. Reduces `warehouse_stocks` for `fromDivisionId` by `cargoWeightMtons`. Returns the created dispatch record.

#### `POST /api/manifest`

Request body:
```json
{
  "fromDivision": "Khulna",
  "toDistrict": "Barisal",
  "crop": "Rice",
  "cargoWeightMtons": 4000,
  "reason": "Storm forecast causing 25% yield loss"
}
```

Calls Gemini generation API with a fixed system prompt:
```
You are a logistics officer for Bangladesh's national food supply chain. 
Write a formal 3-sentence cargo manifest dispatch order. 
Be precise. Include division names, crop type, weight, and reason.
Return only the manifest text, no preamble.
```

Returns: `{ manifestText: "..." }`

### 6.3 Services

#### `server/services/geminiEmbed.js`

```js
// Wraps Gemini EMBEDDING_MODEL=gemini-embedding-001 endpoint.
// Input: string of text
// Output: array of 3072 floats

async function embedText(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } })
  });
  const data = await res.json();
  return data.embedding.values; // 3072 floats
}

module.exports = { embedText };
```

#### `server/services/geminiGenerate.js`

```js
// Wraps Gemini 2.5 Flash generation endpoint.
// Input: system prompt string, user prompt string
// Output: generated text string

async function generateText(systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }]
    })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

module.exports = { generateText };
```

#### `server/services/vectorSearch.js`

```js
// Runs $vectorSearch aggregation against a named collection.
// Input: collection name, query embedding (3072 floats), optional filter, k (number of results)
// Output: array of matched documents

async function vectorSearch(db, collectionName, queryEmbedding, indexName, filter, k = 3) {
  const pipeline = [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: k * 10,
        limit: k,
        filter: filter || undefined
      }
    },
    {
      $project: { embedding: 0 } // never return embedding vectors to the app layer
    }
  ];
  return await db.collection(collectionName).aggregate(pipeline).toArray();
}

module.exports = { vectorSearch };
```

#### `server/services/riskScorer.js`

This service compares a district's `liveWeather` against all `crop_thresholds` documents and returns `riskStatus` + `activeAlerts`. Called by the cron job after each weather refresh.

Logic:
```
for each crop in district.activeCrops:
  find matching threshold doc from crop_thresholds by cropName
  if threshold doc has parsedRules:
    if liveWeather.tempMaxToday > parsedRules.floweringDisruptAbove → RED alert
    if liveWeather.humidityMaxToday > 95 AND liveWeather.tempMaxToday > 30 → YELLOW alert (blast/pest risk)
    if precipitation 3-day sum > 120mm → RED alert (flood/waterlogging risk)
    if precipitation 3-day sum between 60mm and 119mm → YELLOW alert (Heavy Rain / Waterlogging Watch)
  collect all alerts

if any RED alerts → riskStatus = "red"
else if any YELLOW alerts → riskStatus = "yellow"
else → riskStatus = "green"
```

This is deterministic — no LLM involved. The LLM is only used when a user actively queries the chat terminal.

### 6.4 Cron Jobs

#### `server/cron/weatherRefresh.js`

Runs every 6 hours using `node-cron`.

Steps:
1. Fetch all districts from DB.
2. For each district, call Open-Meteo API with district `lat`/`lon`.
3. Update `districts.liveWeather` with the response.
4. Call `riskScorer.scoreDistrict(district)`.
5. Update `districts.riskStatus` and `districts.activeAlerts`.

Rate: 64 districts × 1 Open-Meteo request = 64 HTTP calls per cron run. Run sequentially with a 100ms delay between calls to avoid hammering Open-Meteo.

---

## 7. RAG Pipeline — Detailed

### 7.1 Phase 1 — Ingestion (runs once, then on schedule)

**Step 1: Scrape raw data → raw collections**

Run `server/scrapers/scrapeBulletins.js` (zila IDs 1–64), `scrapeDiseases.js` (disease IDs 1–150, skip 404s), `scrapeThresholds.js` (IDs 1–100, skip 404s). These call your existing local scraper servers and insert into raw collections. If a document with the same `_id` already exists, upsert (replace) it.

**Step 2: Parse raw → chunk → embed → write RAG collections**

Run `server/ingestion/runIngestion.js` which calls:

- `parseBulletins.js`: reads `raw_bulletins`, splits each bulletin's `rawText` by crop-section headers (known header list: ধান আমন, ধান আউশ, ধান বোরো, সবজি, উদ্যান ফসল, গবাদি পশু, হাঁসমুরগী, মৎস্য), builds `ragContextChunk` per section, calls `embedText()` per chunk, inserts into `regional_advisories`.
- `parseDiseases.js`: reads `raw_diseases`, for each `sections` entry where `text` is substantively longer than `title` (i.e. not a stub), builds `ragContextChunk`, embeds, inserts into `crop_pathology`.
- `parseThresholds.js`: reads `raw_thresholds`, builds one chunk per threshold doc (the entire `rawText` is short enough to be one chunk), additionally runs numeric extraction regex to populate `parsedRules`, embeds, inserts into `crop_thresholds`.

**Embedding rate limit management:**  
Free tier: 1,500 embedding requests/minute. Add a 50ms delay between embedding calls. Total corpus estimate: ~64 bulletins × ~6 sections = ~384 advisory chunks + ~150 disease sections + ~100 threshold docs = ~634 total embedding API calls. At 50ms/call = ~32 seconds total. Well within limits.

### 7.2 Phase 2 — Query time (per user message)

```
User sends: POST /api/rag/query
  { question: "...", districtId: "22", language: "en" }

1. embedText(question) → queryVector (3072 floats)

2. Parallel $vectorSearch calls:
   a. regional_advisories, index: advisory_vector_index,
      filter: { districtId: "22" }, k=3
   b. crop_pathology, index: pathology_vector_index,
      no filter, k=2
   c. crop_thresholds, index: threshold_vector_index,
      no filter, k=2

3. Fetch district's liveWeather from districts collection
   (plain findOne query, not vector search)

4. Build prompt (see §7.3)

5. generateText(systemPrompt, userPrompt) → answer

6. Return answer as JSON or SSE stream
```

### 7.3 Prompt Template

```
SYSTEM:
You are KrishiNexus, an AI agricultural crisis advisor for Bangladesh.
You assist institutional decision-makers — extension officers and supply chain managers.
You speak in precise, professional language.
You ONLY cite information found in the provided context documents.
If the context does not contain enough information to answer, say so clearly.
Do not invent crop advice, chemical names, or dosages.
Respond in {language}.

USER:
DISTRICT: {districtName} (ID: {districtId})

LIVE WEATHER (as of {fetchedAt}):
- Today max temp: {tempMaxToday}°C
- Today min temp: {tempMinToday}°C
- Today max humidity: {humidityMaxToday}%
- 7-day precipitation forecast (mm): {precipitationSum7Day.join(', ')}

ACTIVE ALERTS: {activeAlerts.map(a => a.label).join(', ') || 'None'}

RETRIEVED CONTEXT DOCUMENTS:
--- Advisory 1 ---
{regional_advisories[0].ragContextChunk}
--- Advisory 2 ---
{regional_advisories[1].ragContextChunk}
--- Advisory 3 ---
{regional_advisories[2].ragContextChunk}
--- Disease Info 1 ---
{crop_pathology[0].ragContextChunk}
--- Disease Info 2 ---
{crop_pathology[1].ragContextChunk}
--- Threshold Info 1 ---
{crop_thresholds[0].ragContextChunk}
--- Threshold Info 2 ---
{crop_thresholds[1].ragContextChunk}

OPERATOR QUESTION:
{question}
```

---

## 8. Frontend — React

### 8.1 Setup

- **Bundler:** Vite
- **React version:** 18+
- **Key dependencies:**
  - `react-simple-maps` — district map
  - `recharts` — weather charts
  - `axios` — API calls
  - `react-router-dom` v6 — routing
  - `framer-motion` — animations
  - `d3-geo` — centroid calculations (comes with react-simple-maps)

### 8.2 Global State — `AppContext`

One context manages the app-wide selected district so the `/logistics` page can read whatever was selected on `/dashboard`.

```js
// context/AppContext.jsx
// State:
{
  selectedDistrict: null,        // full district object from API
  allDistricts: [],              // all 64 districts, loaded once on app mount
  alertCounts: { red: 0, yellow: 0, green: 0 }  // computed from allDistricts
}
// Actions:
selectDistrict(districtObject)
setAllDistricts(districtsArray)
```

### 8.3 Visual Design System

**Theme:** Dark command-room / mission control. Not a consumer app aesthetic.

**Color palette:**
```css
--bg-primary:    #0a0e1a;   /* deep navy — base background */
--bg-surface:    #111827;   /* slightly lighter surface for panels */
--bg-card:       #1a2235;   /* card backgrounds */
--border:        #1e3a5f;   /* subtle blue-tinted borders */
--text-primary:  #e2e8f0;   /* near-white body text */
--text-secondary:#94a3b8;   /* muted labels */
--accent-green:  #00ff88;   /* pulsing stable districts, positive indicators */
--accent-yellow: #f59e0b;   /* warning districts */
--accent-red:    #ef4444;   /* critical districts */
--accent-blue:   #3b82f6;   /* interactive elements, selected state */
--font-mono:     'JetBrains Mono', monospace;   /* terminal / data readouts */
--font-body:     'Inter', sans-serif;
```

**District map colors on the SVG:**
- Green district: fill `#052e16`, stroke `#00ff88`, pulse animation (opacity 0.4→1.0, 2s loop)
- Yellow district: fill `#451a03`, stroke `#f59e0b`
- Red district: fill `#450a0a`, stroke `#ef4444`, faster pulse (1s loop)
- Selected district: fill `#1e3a5f`, stroke `#3b82f6`, stroke-width 2

### 8.4 Routing

```js
// main.jsx
<Router>
  <AppProvider>
    <Routes>
      <Route path="/"           element={<Landing />} />
      <Route path="/dashboard"  element={<Dashboard />} />
      <Route path="/logistics"  element={<Logistics />} />
    </Routes>
  </AppProvider>
</Router>
```

### 8.5 API Client — `api/index.js`

All backend calls are centralised here. `BASE_URL` comes from `import.meta.env.VITE_API_URL`.

```js
export const getDistricts = () => axios.get(`${BASE_URL}/api/districts`);
export const getDistrict  = (id) => axios.get(`${BASE_URL}/api/districts/${id}`);
export const postRagQuery = (body) => axios.post(`${BASE_URL}/api/rag/query`, body);
export const calcLogistics = (body) => axios.post(`${BASE_URL}/api/logistics/calculate`, body);
export const dispatchCargo = (body) => axios.post(`${BASE_URL}/api/logistics/dispatch`, body);
export const genManifest   = (body) => axios.post(`${BASE_URL}/api/manifest`, body);
```

---

## 9. Page Specifications

### 9.1 `/` — Landing Page

**Purpose:** Establish institutional framing and direct users to `/dashboard`.  
**No API calls on this page.** Fully static.

**Sections (top to bottom):**

**Hero:**
- Full-viewport dark background with a subtle animated particle field or slow-scrolling grid overlay (CSS only, no heavy library).
- Centered headline: "KrishiNexus" in large monospace font, with a thin blinking cursor character after it.
- Subheadline: "Macro-Agricultural Supply Chain & Climate Resilience Control Room for Bangladesh"
- Two CTA buttons: "Enter Dashboard →" (links to `/dashboard`) and "View Logistics →" (links to `/logistics`).
- Below the headline: three animated counter stats (count up on scroll-into-view using `IntersectionObserver`):
  - `64 Districts Monitored`
  - `Real-Time Climate Analysis`
  - `AI-Powered Risk Advisory`

**Problem Statement:**
- Three stat cards in a row:
  - "~18M hectares of cropland at climate risk" — source: BBS
  - "Flood damage averages ৳12,000 crore/year" — source: government report
  - "64% of GDP exposure linked to Aman rice season" — source: DAE
- Each card has a glowing red/amber border and a small icon.

**How It Works (4-step horizontal flow):**
- Step 1: "Live Climate Ingestion" — Open-Meteo + BAMIS feeds
- Step 2: "AI Risk Scoring" — threshold comparison engine
- Step 3: "RAG Advisory Generation" — Gemini + knowledge base
- Step 4: "Supply Chain Response" — logistics routing engine
- Connected by arrow lines. On mobile, stacks vertically.

**Feature Preview Cards (3 cards):**
- "District Operations Center" → link to `/dashboard`
- "Supply Chain Optimizer" → link to `/logistics`
- "AI Knowledge Base" → scrolls to #how-it-works

**Footer:**
- "Data Sources: BAMIS (DAE), BBS, Open-Meteo, bdapi"
- "Built for [Competition Name] — Track B: Environment & Sustainability"

### 9.2 `/dashboard` — Operations Command Center

**Layout:** Three-column, full-height, no scroll on desktop (columns scroll internally). On mobile: single column, stacked.

```
┌──────────────────────────────────────────────────────────────┐
│ [KRISHINEXUS]  /dashboard                    [●] LIVE 06:14  │
├─────────────┬────────────────────────┬───────────────────────┤
│ LEFT PANEL  │   CENTER (MAP)         │  RIGHT PANEL          │
│ 250px fixed │   flex-grow            │  380px fixed          │
│             │                        │                       │
│ Division    │  react-simple-maps     │ [A] Sector Telemetry  │
│ accordion   │  SVG district map      │     Weather chart     │
│ → Districts │  pulsing risk colors   │     Active crops      │
│             │  hover tooltips        │                       │
│ Alert       │  click → zoom +        │ [B] AI Advisory       │
│ badges      │  select district       │     RAG response      │
│             │                        │     streams here      │
│             │                        │                       │
│             │                        │ [C] Chat Terminal     │
│             │                        │     Input + history   │
└─────────────┴────────────────────────┴───────────────────────┘
```

**Left Panel — `LeftNav.jsx`:**
- Header: "REGION SELECTOR"
- Search input (filters district list by name as user types)
- Accordion: 8 divisions, each expandable to show their districts as list items
- Each district list item shows: district name + a colored dot (risk color) + alert count badge
- Clicking a district list item calls `selectDistrict()` — same action as clicking the map
- Below accordion: "NATIONAL STATUS" section with 3 badges:
  - `[● N] SEVERE RISK` (count of red districts, red badge)
  - `[● N] WARNINGS` (yellow)
  - `[● N] STABLE` (green)
- These counts come from `alertCounts` in `AppContext`, computed when `allDistricts` loads.

**Center Panel — `BangladeshMap.jsx`:**

Uses `react-simple-maps`:
```jsx
<ComposableMap
  projection="geoMercator"
  projectionConfig={{ center: [90.3, 23.7], scale: 3200 }}
>
  <ZoomableGroup zoom={zoom} center={center} onMoveEnd={handleMoveEnd}>
    {allDistricts.map(district => (
      <Geography
        key={district._id}
        geography={geoFeatures[district._id]}  // GeoJSON feature matched by id
        onClick={() => handleDistrictClick(district)}
        onMouseEnter={() => setHoveredDistrict(district)}
        onMouseLeave={() => setHoveredDistrict(null)}
        style={{
          default: { fill: riskFill(district.riskStatus), stroke: riskStroke(district.riskStatus) },
          hover:   { fill: '#1e3a5f', cursor: 'pointer' },
          pressed: { fill: '#1e3a5f' }
        }}
      />
    ))}
  </ZoomableGroup>
</ComposableMap>
```

When a district is clicked:
1. `ZoomableGroup` animates to center on that district's lat/lon at zoom level 4.
2. `selectDistrict(district)` is called on AppContext.
3. Right panel switches from "Select a district" placeholder to live data.

**Hover tooltip — `DistrictTooltip.jsx`:**
- Appears 12px above cursor on hover.
- Shows: district name (Bengali + English), riskStatus badge, today's temp, active alert count.
- Data comes from `allDistricts` already in memory — no API call on hover.

**Right Panel — three sections:**

**Section A — `TelemetryPanel.jsx`:**
- Header: "SECTOR TELEMETRY — {districtName}"
- `WeatherChart.jsx`: Recharts `AreaChart` showing 7-day precipitation forecast. X-axis: dates. Y-axis: mm. Fill color: blue gradient. A horizontal dashed red line at 10mm marks the "heavy rain threshold."
- Below chart: two metric cards in a row — "Today Max Temp" and "Today Max Humidity"
- Below metrics: "Active Crops" chips (from `district.activeCrops`)

**Section B — `RagAdvisory.jsx`:**
- Header: "AI CRISIS ADVISORY"
- On district select: auto-fires a pre-set query: `"Summarize current agricultural risk and key advisories for this district."` — no user action needed.
- Shows a loading skeleton while the RAG query is running.
- Response renders with a typewriter effect (character-by-character reveal using `useState` + `setInterval`).
- Below the advisory: small grey text "Generated from BAMIS bulletins + Gemini 2.5 Flash. Not a substitute for official DAE guidance."

**Section C — `ChatTerminal.jsx`:**
- Header: "CONTEXTUAL INTERROGATOR"
- A scrollable message history area styled as a dark terminal.
- Input at the bottom: monospace placeholder `"> Enter directive or query..."`
- On submit: shows the user's message in green monospace, shows a blinking cursor while waiting, then typewriter-renders the response in white.
- Each message has a timestamp.
- `districtId` is automatically attached to every query from the currently selected district.
- Chat history is React state only — not persisted to DB. Clears on district change.

### 9.3 `/logistics` — Supply Chain Command Interface

**Layout:** Full page, scrollable. No fixed side panels.

**Top bar:**
- "LOGISTICS & SUPPLY CHAIN OPTIMIZATION RUNTIME"
- District selector dropdown (reads from `allDistricts` in AppContext). Pre-populated with whatever district was selected on `/dashboard`. User can change it here without going back to the map.
- Crop selector: dropdown of crops available in `market_production_baselines` for that district.

**Zone A — Deficit & Risk Assessment Grid (left ~50%):**

Metric cards in a 2×2 grid:
- **BBS Baseline Yield** — from `market_production_baselines.latestBaselineMtons`. Label: "Historical Production Baseline (M.Ton)"
- **Climate Severity Factor** — the slider (see below). Label: "Simulated Climate Risk"
- **Projected Shortfall** — computed in React: `baseline × severityFactor`. Updates instantly as slider moves. Text turns dark red if above 20% of baseline.
- **Market Price Pressure** — `+{(severityFactor × 72).toFixed(0)}% surge risk`. (72% is a coefficient — i.e. a 25% yield loss → ~18% price pressure, matching your wireframe. Defensible as a simplified supply-demand elasticity model.)

**Severity Slider:**
- Range: 0% to 75%
- Default: 25%
- Label: "Simulate Climate Severity Factor"
- Moving it instantly recalculates Projected Shortfall and Market Price Pressure cards via React state — no API call.
- Below slider: a small note "Adjust to model different climate scenario severities."

A "Calculate Logistics Plan" button triggers `POST /api/logistics/calculate` with the current `districtId`, `crop`, and `severityFactor`. Until clicked, Zone B shows a placeholder.

**Zone B — Automated Logistics Engine (right ~50%):**

Route Recommendation Card (appears after "Calculate Logistics Plan" is clicked):
- "RECOMMENDED SUPPLY ROUTE"
- From: {surplusDivision name}
- To: {selectedDistrict name}
- Crop: {crop}
- Available Reserve: {surplusDivisionReserve} M.Ton
- Distance: {distanceKm} km
- Recommended Cargo: {recommendedCargo} M.Ton

Cargo weight input: pre-filled with `recommendedCargo` from API. User can edit it.

Two buttons:
- **"Generate AI Shipping Manifest"** — calls `POST /api/manifest`. Response text appears in a bordered "manifest box" styled like a printed document (lighter background, serif font). Shows a loading spinner while generating.
- **"Approve & Route Supply Chain"** — calls `POST /api/logistics/dispatch`. On success: cargo weight input and both buttons are replaced by a green status card: "DISPATCHED — Cargo routing initiated. Supply fleet en route from {fromDivision} to {toDistrict}." A subtle animated progress bar plays for 3 seconds (purely cosmetic).

**Zone C — National Warehouse Stocks Table:**

Full-width table at the bottom. Displays all 24 warehouse stock documents (8 divisions × 3 crops).

Columns: Division | Crop | Reserve (M.Ton) | Status
"Status" column logic: if reserve < 20,000 → "Low ⚠️" (amber); if reserve < 10,000 → "Critical 🔴"; else "Adequate ✓" (green).

A banner above the table reads: `⚠️ SIMULATED DATA — Warehouse stock figures are modelled estimates for demonstration purposes.`

Recent dispatch records table below: shows last 5 `dispatch_records` from DB. Columns: Date | From | To | Crop | Cargo (M.Ton) | Status.

---

## 10. Deployment

### 10.1 MongoDB Atlas

1. Create a free M0 cluster at `cloud.mongodb.com`.
2. Create database `krishinexus`.
3. Create a database user with read/write access.
4. Whitelist all IPs (0.0.0.0/0) for Render compatibility.
5. After running ingestion (§7.1), create three vector search indexes in the Atlas UI:

For each of the three RAG-ready collections (`regional_advisories`, `crop_pathology`, `crop_thresholds`), go to Atlas → Search → Create Index → JSON Editor:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "districtId"
    }
  ]
}
```

The `districtId` filter field is only needed for `regional_advisories` (the others don't filter by district). You can omit it for `crop_pathology` and `crop_thresholds`.

### 10.2 Render (Backend)

1. Push `server/` to a GitHub repo.
2. Create a new Render Web Service, connect the repo.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Set all environment variables (§11).
6. Free tier spins down after 15 minutes of inactivity — for competition demo, upgrade to Starter ($7/month) to keep it always-on, or warn judges it may take 30 seconds to cold-start.

### 10.3 Vercel (Frontend)

1. Push `client/` to GitHub (can be same repo, different directory).
2. Import project in Vercel, set root directory to `client/`.
3. Build command: `vite build`
4. Output directory: `dist`
5. Set environment variable: `VITE_API_URL=https://your-render-service.onrender.com`

---

## 11. Environment Variables

### Server (`server/.env`)

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/krishinexus
GEMINI_API_KEY=<your Gemini API key from Google AI Studio>
CLIENT_URL=https://your-vercel-app.vercel.app
PORT=5000
```

### Client (`client/.env`)

```
VITE_API_URL=https://your-render-service.onrender.com
```

For local development:
```
VITE_API_URL=http://localhost:5000
```

---

## 12. Build Order

Follow this exact sequence. Do not skip steps — each depends on the previous.

**Step 1:** Set up MongoDB Atlas cluster. Get connection string. Set `MONGODB_URI` in env.

**Step 2:** Seed `divisions` and `districts` collections from bdapi. Run `server/db/seeds/seedDivisions.js` and `server/db/seeds/seedDistricts.js`. Verify 8 + 64 documents in Atlas.

**Step 3:** Build and verify the BAMIS zilaId ↔ bdapi district id mapping. Scrape all 64 bulletins, extract district names from `rawText`, match to bdapi district names, write `server/ingestion/zilaIdMap.json`. Update `bamisZilaId` field on all `districts` documents.

**Step 4:** Seed `warehouse_stocks` from `server/db/seeds/warehouseStocks.js`. Verify 24 documents.

**Step 5:** Run scrapers — `scrapeBulletins.js`, `scrapeDiseases.js`, `scrapeThresholds.js`. Verify raw collections are populated.

**Step 6:** Run `parseBBS.js` to load the BBS Kaggle CSV into `market_production_baselines`.

**Step 7:** Run `runIngestion.js` to parse raw collections into RAG-ready collections and call Gemini embedding API. This is the longest step (~1 minute). Verify `regional_advisories`, `crop_pathology`, `crop_thresholds` documents have `embedding` arrays of length 3072.

**Step 8:** Create the three Atlas Vector Search indexes (§10.1). Wait for them to be in "Ready" state (usually 1–2 minutes).

**Step 9:** Build and test the Express backend locally. Test each route with Postman or curl. Especially test `POST /api/rag/query` end-to-end.

**Step 10:** Download and prepare Bangladesh ADM2 GeoJSON (§4.5). Place at `client/public/bd-districts.geojson`. Build the `geoNameMap.json` district name reconciliation file.

**Step 11:** Build the React frontend. Start with `AppContext`, then the map, then the right panel sections, then the landing page, then the logistics page.

**Step 12:** Deploy backend to Render, frontend to Vercel. Test on live URLs.

**Step 13:** Run the weather cron job manually once to populate `liveWeather` and `riskStatus` on all districts before the demo. Verify the map shows colored districts.

---

## 13. Assumptions & Open Questions

The following items require decisions or verification that could not be determined from available information. Each is marked with the consequence of getting it wrong.

| # | Item | Assumption Made | Consequence If Wrong |
|---|---|---|---|
| 1 | BAMIS zilaId ↔ bdapi district id mapping | Assumed mismatch is possible — mapping must be verified manually (Step 3) | Advisories attached to wrong districts — RAG returns wrong district's data |
| 2 | BAMIS bulletin header keywords | Assumed the listed 8 headers (ধান আমন, সবজি, etc.) cover all sections | Some crop sections may not be parsed → missing advisories in RAG |
| 3 | BAMIS disease/threshold ID ranges | Assumed 1–150 for diseases, 1–100 for thresholds with 404-skipping | May miss higher IDs — can be fixed by extending range in scraper |
| 4 | GeoJSON shapeName ↔ bdapi district name | Some mismatches expected (e.g. "Chittagong" vs "Chattagram") | Districts won't render on map or will render in wrong position |
| 5 | Division centroid lat/lon for logistics distance | Hardcoded 8 centroids needed for Haversine calculation | Minor inaccuracy in distance estimates — not a blocking issue |
| 6 | BBS dataset district name format | Assumed English names matching bdapi names closely | Some BBS districts may not resolve → missing production baselines for those districts |
| 7 | Gemini 2.5 Flash availability | Assumed available on free tier for generation | Fall back to `gemini-1.5-flash` if 2.5 Flash is not accessible with your key |
| 8 | `activeCrops` per district | Assumed to be parsed from latest bulletin's crop section headers | If bulletin parsing misses a section, activeCrops may be incomplete |

**Division centroids (assumption #5 — hardcode these values):**
```js
const DIVISION_CENTROIDS = {
  "1": { name: "Chattagram", lat: 22.8, lon: 91.8 },
  "2": { name: "Rajshahi",   lat: 24.4, lon: 88.6 },
  "3": { name: "Khulna",     lat: 22.8, lon: 89.5 },
  "4": { name: "Barishal",   lat: 22.3, lon: 90.4 },
  "5": { name: "Sylhet",     lat: 24.9, lon: 91.9 },
  "6": { name: "Dhaka",      lat: 23.7, lon: 90.4 },
  "7": { name: "Rangpur",    lat: 25.7, lon: 89.2 },
  "8": { name: "Mymensingh", lat: 24.7, lon: 90.4 }
};
```