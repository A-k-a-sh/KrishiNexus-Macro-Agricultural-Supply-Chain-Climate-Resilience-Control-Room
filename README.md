# KrishiNexus
### Macro-Agricultural Supply Chain & Climate Resilience Control Room

> **Competition Track:** Track B — Environment & Sustainability  
> **Team:** SICBlitz, CUET

Bangladesh's 64 districts produce food for ~170 million people. When a flood hits Sunamganj or a pest outbreak sweeps Tangail, institutional decision-makers — extension officers, supply chain managers, food security officials — have no unified, real-time system to see what's happening, what the official advisory says, and how to route relief supplies. **KrishiNexus is that system.**

---

## 🔴 The Problem

- **18M+ hectares** of cropland exposed to annual climate shocks (floods, drought, salinity intrusion, pest surges)
- **৳12,000 crore/year** average flood-related agricultural damage
- Government knowledge (BAMIS bulletins) is locked behind PDFs and district-by-district web pages — not queryable by AI, not mapped to real-time weather
- No tool exists for an extension officer to ask *"What can be grown in Sunamganj right now?"* and get a grounded, district-specific answer in Bengali

---

## ✅ What KrishiNexus Does

A mission-control web application with three integrated components:

| Component | What It Does |
|---|---|
| **Live Ops Map** | Real-time risk coloring of all 64 Bangladesh districts based on weather vs. crop thresholds |
| **RAG Advisory Engine** | 3-stage AI answer pipeline grounded in official BAMIS bulletins + Gemini 2.5 Flash |
| **Logistics Optimizer** | Haversine-weighted supply routing across 8 division warehouses with AI manifest generation |

---

## ⚡ Unique Engineering — The "Wow Factor"

### 1. Three-Stage RAG Pipeline (Not Just a Chatbot)

Most hackathon RAG systems do one `$vectorSearch` and call Gemini. KrishiNexus runs **three concurrent retrievals plus a full government document injection**:

```
User Query (Bengali/English)
       │
       ▼ embed (gemini-embedding-001, 768-dim)
       │
  ┌────┴─────────────────────────────────────────────────┐
  │   PARALLEL $vectorSearch (MongoDB Atlas)              │
  │                                                       │
  │  ① regional_advisories   — district-scoped (k=5)    │
  │     BAMIS crop bulletins, parsed into per-crop chunks │
  │                                                       │
  │  ② crop_pathology        — global disease DB (k=5)  │
  │     150+ BAMIS disease pages, section-chunked         │
  │                                                       │
  │  ③ crop_thresholds       — weather thresholds (k=2) │
  │     Crop-specific temp/humidity optimal ranges        │
  └────────────────────────────────────────────────────┘
       │
  ④ PRIMARY: Full raw BAMIS bulletin injected from         
     raw_bulletins collection (district lookup via         
     zilaIdMap reverse-index — no extra scrape, no lag)    
       │
       ▼
  Gemini 2.5 Flash (maxOutputTokens: 8192)
  → Priority order: bulletin → vector results → own knowledge
  → Bengali or English auto-detected from query language
```

**Why this matters:** Vector search alone fails for district-specific "what can I grow?" questions because embedding similarity doesn't always surface the right bulletin section. By also injecting the complete official bulletin for the user's district, the model always has the primary source document — meaning zero hallucination on crop-specific advice.

### 2. Efficiency-Scored Logistics Routing (Not Greedy Stock Selection)

The original approach (and most naive implementations) would pick the division with the highest warehouse stock. We replaced it with a **supply efficiency score**:

```
score = reserveMtons / distanceKm
```

This means the "FROM" division **changes per destination district**. A district in northern Bangladesh gets supply from Rangpur (close, large stock). A southern district gets supply from Khulna or Barishal (nearer). The Haversine formula uses real district lat/lon vs. hardcoded division centroids for all 8 divisions.

This is a defensible supply-chain optimization model based on transport cost minimization — not a demo shortcut.

### 3. Deterministic Risk Scoring + Live Weather = Automated Alert Engine

Every 6 hours (updated 24h for vercel requirement), a cron job:
1. Pulls Open-Meteo 7-day forecasts for all **64 districts** (256 API calls/day — fits the free tier)
2. Compares live weather against `parsedRules` extracted from BAMIS crop threshold documents
3. Applies rule logic: temp > floweringDisruptAbove → RED; humidity > 90% & temp > 28°C → YELLOW (blast/pest); 3-day precipitation sum > 50mm → RED (flood)
4. Writes `riskStatus` + `activeAlerts` back to each district document
5. The entire map re-colors automatically — no human intervention needed

The rule engine is deterministic (no LLM). The LLM is only invoked when a user actively queries the advisory or chat. This is intentional — deterministic alerts are auditable; LLM-generated alerts are not.

### 4. Real Government Data, Not Synthetic Demos

| Data Source | What Was Done |
|---|---|
| **BAMIS bulletins** | Scraped all 64 districts via zilaId 1–64; raw text stored in MongoDB |
| **BAMIS diseases** | Scraped 150+ disease pages; section-chunked and embedded |
| **BAMIS thresholds** | Scraped 100+ crop threshold documents; regex-extracted numeric rules |
| **bdapi** | Seeded all 64 districts with lat/lon, division hierarchy |
| **Open-Meteo** | Live 7-day weather per district, refreshed every 6 hours |
| **BBS production data** | Loaded from Kaggle dataset into `market_production_baselines` for logistics baseline |

The BAMIS zilaId ↔ bdapi district ID mapping is non-trivial (they use different numbering systems). We built a verified `zilaIdMap.json` by cross-matching district names extracted from raw bulletin text against the bdapi district name list.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                │
│  /  (Landing)    /dashboard    /logistics                    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│                  EXPRESS API (Node.js)                        │
│                                                              │
│  Ingestion Pipeline   Cron Jobs           API Routes         │
│  ─────────────────    ───────────────     ──────────────     │
│  scrapeBulletins      weatherRefresh      GET  /districts    │
│  scrapeDiseases       (every 6 hours)     GET  /districts/:id│
│  scrapeThresholds     riskScorer          POST /rag/query    │
│  parseBulletins       (deterministic)     POST /logistics/.. │
│  parseDiseases                            POST /manifest     │
│  parseThresholds                                             │
│  embedAndStore                                               │
└───────────┬──────────────┬────────────────────────────────┘
            │              │
┌───────────▼──┐    ┌──────▼───────────────────────────────┐
│  Gemini API  │    │         MongoDB Atlas                  │
│              │    │                                        │
│  embedding   │    │  raw_bulletins       (64 docs)         │
│  gemini-     │    │  raw_diseases        (150+ docs)       │
│  embedding   │    │  raw_thresholds      (100+ docs)       │
│  -001        │    │  districts           (64 docs, live)   │
│              │    │  regional_advisories (384+ chunks+vec) │
│  generation  │    │  crop_pathology      (150+ chunks+vec) │
│  gemini-2.5  │    │  crop_thresholds     (100+ chunks+vec) │
│  -flash      │    │  market_baselines    (BBS production)  │
│              │    │  warehouse_stocks    (8÷×3 crops)      │
└──────────────┘    │  dispatch_records    (live ops log)    │
                    └───────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast HMR, SPA routing |
| **Mapping** | react-simple-maps + Bangladesh ADM2 GeoJSON | District-level polygon rendering |
| **Charts** | Recharts AreaChart | 7-day precipitation visualization |
| **Styling** | Vanilla CSS (CSS custom properties) | Full design control, dark command-room theme |
| **Backend** | Node.js + Express | REST API, cron scheduling |
| **Database** | MongoDB Atlas (M0 free tier) | Vector Search + document model |
| **AI — Embedding** | `gemini-embedding-001` (768 dimensions) | Government text embedding |
| **AI — Generation** | `gemini-2.5-flash` (maxOutputTokens: 8192) | Bengali + English advisory generation |
| **Weather** | Open-Meteo API (free, no key) | Daily forecasts for all 64 districts |
| **Deployment** | Vercel (frontend) + Render (backend) | Standard hackathon stack |

---

## 📁 Repository Structure

```
krishinexus/
├── backend/
│   ├── routes/
│   │   ├── districts.js          # GET /api/districts, GET /api/districts/:id
│   │   ├── rag.js                # POST /api/rag/query — 3-stage RAG pipeline
│   │   ├── logistics.js          # POST /calculate, /dispatch, GET /warehouse-stocks
│   │   └── manifest.js           # POST /api/manifest — Gemini shipping manifest
│   ├── services/
│   │   ├── geminiEmbed.js        # gemini-embedding-001 wrapper
│   │   ├── geminiGenerate.js     # gemini-2.5-flash wrapper (8192 token output)
│   │   ├── vectorSearch.js       # MongoDB $vectorSearch wrapper
│   │   ├── riskScorer.js         # Deterministic weather-vs-threshold alert engine
│   │   └── weatherFetcher.js     # Open-Meteo per-district fetcher
│   ├── ingestion/
│   │   ├── scrapeBulletins.js    # BAMIS bulletin scraper (zilaId 1–64)
│   │   ├── scrapeDiseases.js     # BAMIS disease page scraper
│   │   ├── scrapeThresholds.js   # BAMIS threshold scraper
│   │   ├── parseBulletins.js     # raw → crop-section chunks → regional_advisories
│   │   ├── parseDiseases.js      # raw → section chunks → crop_pathology
│   │   ├── parseThresholds.js    # raw → chunks + numeric rule extraction → crop_thresholds
│   │   ├── embedAndStore.js      # Calls Gemini embedding API, writes 768-dim vectors
│   │   ├── syncRegionalAdvisoryDistrictIds.js  # zilaId → districtId repair script
│   │   └── runIngestion.js       # Master ingestion orchestrator
│   ├── cron/
│   │   └── weatherRefresh.js     # 6-hour cron: weather → risk scoring → DB update
│   ├── db/
│   │   ├── connect.js
│   │   └── seeds/
│   │       ├── seedDistricts.js  # Pulls from bdapi, seeds 64 districts
│   │       └── warehouseStocks.js # Seeds 8 division × 3 crop reserve figures
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   └── BangladeshMap.jsx    # react-simple-maps SVG, risk colors, zoom
│   │   │   └── Dashboard/
│   │   │       ├── LeftNav.jsx          # Division accordion + district selector
│   │   │       ├── TelemetryPanel.jsx   # Weather chart + crop/alert readouts
│   │   │       ├── RagAdvisory.jsx      # Auto-fires advisory on district select
│   │   │       ├── ChatTerminal.jsx     # Contextual interrogator + sample prompts
│   │   │       └── WeatherChart.jsx     # Recharts 7-day precipitation area chart
│   │   ├── pages/
│   │   │   ├── Landing.jsx              # Hero + stats + how-it-works
│   │   │   ├── Dashboard.jsx            # 3-column ops center
│   │   │   └── Logistics.jsx            # Zone A/B/C supply chain interface
│   │   ├── context/AppContext.jsx        # Global selectedDistrict + allDistricts
│   │   └── api/index.js                 # All axios calls centralised
│   └── public/
│       └── bd-districts.geojson         # Bangladesh ADM2 boundaries (simplified)
│
└── others/
    ├── krishinexus_specs.md             # Full canonical technical specification
    └── data, chunk, embeed/
        ├── data/raw_bulletins.jsonl     # Scraped BAMIS bulletins (backup)
        └── data/zilaIdMap.json          # BAMIS zilaId ↔ bdapi districtId mapping
```

---

## 🖥️ Pages & Features

### `/` — Landing

Full-viewport dark hero with animated grid background, animated statistics counters, and a 4-step "how it works" flow explaining the pipeline from data ingestion to supply chain response. Links to `/dashboard` and `/logistics`.

### `/dashboard` — Operations Command Center

Three-column, full-height mission control layout:

- **Left panel** — Division accordion (8 divisions → 64 districts). Each district shows a color dot (risk status) and alert count. National summary: RED / YELLOW / GREEN counts
- **Center** — Interactive SVG map of Bangladesh. Districts pulse in their risk color. Click → zoom + select. Hover → tooltip with temp, alerts, district name in Bengali + English
- **Right panel** — Three tabs:
  - **TELEMETRY** — 7-day precipitation area chart, max temp/humidity cards, active crop chips
  - **AI ADVISORY** — Auto-fires on district select. Shows AI-generated risk summary grounded in BAMIS bulletin + Gemini 2.5 Flash
  - **INTERROGATOR** — Chat terminal. Bengali/English queries answered from the 3-stage RAG pipeline. One-click sample prompts: "কী কী ফসল চাষ করা যাবে?", "What are the current pest risks?", etc.

### `/logistics` — Supply Chain Command Interface

- **Zone A** — BBS production baseline, climate severity slider (0–75%), projected deficit and price pressure recalculated in real time
- **Zone B** — Calculates optimal supply route using efficiency scoring (stock/distance). FROM changes per district. Generates AI shipping manifest via Gemini. One-click dispatch reduces warehouse stock in DB
- **Zone C** — Live warehouse stock table (8 divisions × 3 crops) + recent dispatch history

---

## 💻 Local Development Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (free M0 tier)
- Google AI Studio API key (for Gemini)

### Backend

```bash
cd backend
cp .env.example .env          # Fill in MONGODB_URI and GEMINI_CHAT_KEY / GEMINI_EMBED_KEY

npm install

# Seed divisions and districts from bdapi
node db/seeds/seedDistricts.js

# Seed warehouse stocks (8 divisions × 3 crops = 24 docs)
node db/seeds/warehouseStocks.js

# Scrape and ingest BAMIS knowledge base
node ingestion/scrapeBulletins.js      # raw bulletins → raw_bulletins collection
node ingestion/scrapeDiseases.js       # raw disease pages → raw_diseases collection
node ingestion/scrapeThresholds.js     # raw thresholds → raw_thresholds collection
node ingestion/runIngestion.js         # parse → chunk → embed → write RAG collections

# Start server
npm run dev    # nodemon server.js on port 5001
```

After ingestion, create **three Atlas Vector Search indexes** (JSON mode) on:
- `regional_advisories` (field: `embedding`, dims: 768, similarity: cosine, filter: `districtId`)
- `crop_pathology` (field: `embedding`, dims: 768, similarity: cosine)
- `crop_thresholds` (field: `embedding`, dims: 768, similarity: cosine)

### Frontend

```bash
cd frontend
cp .env.example .env           # Set VITE_API_URL=http://localhost:5001

npm install
npm run dev                    # Vite dev server on port 5173
```

---

## 🌐 Environment Variables

### `backend/.env`

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/agri_data
GEMINI_CHAT_KEY=<your Gemini API key>
GEMINI_EMBED_KEY=<your Gemini API key>
CLIENT_URL=http://localhost:5173
PORT=5001
BAMIS_BULLETIN_BASE_URL=http://localhost:5001/api/fetch-bulletin
```

### `frontend/.env`

```
VITE_API_URL=http://localhost:5001
```

---

## 🗃️ Database Collections

| Collection | Documents | Description |
|---|---|---|
| `districts` | 64 | Live district data: weather, risk status, alerts, crops |
| `raw_bulletins` | 64 | Full BAMIS bulletin text per district |
| `raw_diseases` | 150+ | BAMIS disease page raw text |
| `raw_thresholds` | 100+ | BAMIS crop threshold raw text |
| `regional_advisories` | ~384 | Chunked bulletin sections + 768-dim embeddings |
| `crop_pathology` | ~150 | Chunked disease sections + embeddings |
| `crop_thresholds` | ~100 | Chunked thresholds + embeddings + parsed numeric rules |
| `market_production_baselines` | 64×crop | BBS yield data per district per crop |
| `warehouse_stocks` | 24 | 8 divisions × 3 crops, simulated reserves |
| `dispatch_records` | live | Every approved supply dispatch logged here |

---

## 📊 RAG Query Flow (Technical)

```
POST /api/rag/query
  { question: "কী কী চাষ করা যাবে?", districtId: "36" }

Step 1: Reverse-lookup zilaId
  districtIdToZilaId["36"] → "50"

Step 2: Parallel DB fetch
  Promise.all([
    districts.findOne({ _id: "36" })                        → weather, alerts, crops
    raw_bulletins.findOne({ zilaId: "50" })                 → full official bulletin text
  ])

Step 3: Embed the question
  gemini-embedding-001 → 768-float vector

Step 4: Parallel $vectorSearch
  regional_advisories { districtId: "36" }  k=5  → crop-specific advice chunks
  crop_pathology       (no filter)           k=5  → disease information
  crop_thresholds      (no filter)           k=2  → weather threshold rules

Step 5: Build prompt
  [Official BAMIS Bulletin — first 3000 chars]
  [Vector search results]
  [Live weather + alerts]
  [Operator question]

Step 6: Gemini 2.5 Flash (8192 output tokens)
  → Answer in Bengali or English, ≤250 words
```

---

## 🚀 Deployment

| Service | Platform | Notes |
|---|---|---|
| **Frontend** | Vercel | Set `VITE_API_URL` to Render backend URL |
| **Backend** | Render | Set all env vars; free tier cold-starts in ~30s |
| **Database** | MongoDB Atlas M0 | Whitelist `0.0.0.0/0` for Render compatibility |

Full deployment instructions: [vercel_deployment.md](vercel_deployment.md)

---

## 📖 Technical Specification

See [others/krishinexus_specs.md](others/krishinexus_specs.md) for:
- Full database schema for all 10 collections
- Complete RAG pipeline specification
- All API route contracts
- Vector search index configuration
- BAMIS data source documentation
- Build order and dependency sequence

---

*Built with ❤️ for Track B — Environment & Sustainability | SICBlitz, CUET*
