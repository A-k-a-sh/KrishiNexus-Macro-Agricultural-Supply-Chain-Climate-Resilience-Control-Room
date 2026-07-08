# KrishiNexus

**Macro-Agricultural Supply Chain & Climate Resilience Control Room for Bangladesh**

KrishiNexus is a fullstack web application designed for agricultural extension officers, supply chain managers, and policymakers in Bangladesh. It serves as a centralized "control room" to monitor district-level climate risks, retrieve AI-generated advisories grounded in official agricultural databases, and simulate/route supply chain interventions before crises unfold.

---

## 📖 Key Project Documentation
To keep this repository clean and maintainable, deep technical specifications and deployment procedures are split into separate documents:
*   **Core Technical Specifications**: See the canonical [Project Specification Guide](others/krishinexus_specs.md) for database design schemas, data ingestion pipelines, prompts, and vector search parameters.
*   **Vercel Deployment Guide**: See the [Vercel Deployment Guide](vercel_deployment.md) for hosting both frontend and backend projects under serverless runtimes.

---

## 🚀 Core Features

*   **District Operations Map**: An interactive SVG map of Bangladesh's 64 districts showing live, color-coded climate risk statuses (Green = Stable, Yellow = Warning, Red = Severe).
*   **AI Contextual Advisory (RAG)**: A Gemini-powered Retrieval-Augmented Generation (RAG) system running over scraped bulletins and disease guidelines from BAMIS (Bangladesh Agricultural Weather Information Service) stored inside a MongoDB Atlas Vector Search index.
*   **Automated Logistics Engine**: Simulates regional crop deficits based on BBS (Bangladesh Bureau of Statistics) production benchmarks and dynamic climate severity factors, recommending optimal surplus-division routing plans based on Haversine distance.
*   **AI Shipping Manifests**: Generates formal, structured supply chain cargo orders on-demand using Gemini.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite) + Tailwind CSS + Framer Motion (Animations) + Recharts (Precipitation Analytics) + React Simple Maps (Interactive SVG Map).
*   **Backend**: Node.js + Express.js (REST API + Serverless compatible).
*   **Database**: MongoDB Atlas (Vector Search Indexes).
*   **AI Engine**: Google Gemini API (`gemini-2.5-flash` and `gemini-embedding-001`).
*   **Telemetry Data**: Open-Meteo API (Daily Weather Forecasts).

---

## 📁 Repository Structure

```
krishinexus/
├── api/                  # Vercel root serverless handler entrypoint
├── backend/              # Express API Server
│   ├── routes/           # REST API routes (districts, RAG query, logistics, cron)
│   ├── services/         # Gemini API & vector search integrations, risk scoring
│   ├── cron/             # Concurrency-limited weather fetchers
│   └── db/               # Connection handlers and database seeds
├── frontend/             # React SPA (Vite + TailwindCSS)
│   ├── src/              # App context, custom hooks, and pages
│   └── public/           # Bangladesh ADM2 GeoJSON boundaries
├── others/               # Project spec sheets & documents
└── vercel_deployment.md  # Detailed Vercel deployment manual
```

---

## 💻 Local Development Setup

To run KrishiNexus locally, follow the complete installation steps detailed in the [Build Order Section of the Project Specifications](others/krishinexus_specs.md#L1209-L1239):

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/krishinexus.git
    cd krishinexus
    ```

2.  **Backend Setup**:
    Configure environment variables in `backend/.env` (using `backend/.env.example` as a template), run database seeding/ingestion, and launch:
    ```bash
    cd backend
    npm install
    npm run seed:bdapi  # Seed divisions, districts, and warehouse stocks
    npm run scrape:all  # Pull bulletins, diseases, and thresholds raw data
    npm run ingest      # Compute Gemini embeddings and store in vector collections
    node server.js
    ```

3.  **Frontend Setup**:
    Configure environment variables in `frontend/.env`, install packages, and start:
    ```bash
    cd ../frontend
    npm install
    npm run dev
    ```
