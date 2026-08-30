# RoadResilience AI — Backend

AI-powered discovery and recovery of hidden road connections from incomplete satellite maps.

## Problem Statement

Satellite-based road extraction can produce incomplete or disconnected road maps due to vegetation, shadows, buildings, or image quality. A gap in an extracted road map does not necessarily mean a real road connection is absent.

**Core problem:** Given a suspected gap between road segments, determine whether a real road connection is likely present but missing from the extracted map.

## Solution

RoadResilience AI is an evidence-fusion system that investigates suspected road gaps using multiple independent sources of information — satellite imagery, existing road-network data, and geographic context — coordinated by an AI agent that reasons over the combined evidence.

## Tech Stack

- **Language:** Python 3.13
- **Web Framework:** FastAPI + Uvicorn
- **AI/Agent Reasoning:** Google Gemini (`gemini-3.5-flash`) via function calling
- **Satellite Data:** Microsoft Planetary Computer (Sentinel-2 L2A imagery)
- **Image Processing:** Rasterio, OpenCV (Canny edge detection + Hough Line Transform)
- **Road Network Data:** OpenStreetMap via OSMnx
- **Geographic Context:** OpenStreetMap Overpass API
- **Geospatial Processing:** GeoPandas, Shapely
- **Validation:** Pydantic

## Architecture

```
Frontend → POST /investigate {lat, lon, radius_m}
    ↓
FastAPI (main.py) → run_agent()
    ↓
Gemini Agent (agent.py) — decides which tools to call
    ↓
┌─────────────────┬──────────────────────┬─────────────────────┐
│ Satellite Tool   │ Road Network Tool    │ Geo Context Tool     │
│ (imagery + CV    │ (OSM road segments)  │ (vegetation, water,  │
│  road detection) │                      │  buildings)          │
└─────────────────┴──────────────────────┴─────────────────────┘
    ↓
Gemini reasons over combined evidence
    ↓
Final verdict: {final_answer, confidence, evidence, steps}
```

## Project Structure

```
backend/
├── main.py              # FastAPI app, /investigate endpoint
├── agent.py              # Gemini agent loop
├── schemas.py             # Pydantic request/response models
├── config.py              # Loads GEMINI_API_KEY from .env
├── tools/
│   ├── satellite_tool.py      # Satellite imagery + CV road detection
│   ├── road_network_tool.py   # OSM road network lookup
│   └── geo_context_tool.py    # Vegetation/water/building context
├── tests/                 # Standalone test scripts per tool
└── requirements.txt
```

## API

### `POST /investigate`

**Request:**

```json
{
  "lat": 28.6139,
  "lon": 77.2090,
  "radius_m": 200
}
```

**Response:**

```json
{
  "final_answer": "LIKELY_EXISTS",
  "confidence": 0.95,
  "evidence": [
    "Road network data confirms a connection exists at this location",
    "Mapped segments include Vijay Chowk and Kartavya Path"
  ],
  "steps": [
    "Called check_road_network with {...}",
    "Called get_satellite_evidence with {...}"
  ]
}
```

## Setup

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create a `.env` file with:

```
GEMINI_API_KEY=your_api_key_here
```

Run the server:

```bash
uvicorn main:app --reload
```

Server runs at `http://127.0.0.1:8000`.

## Key Design Decisions

- **Agentic approach:** Gemini dynamically decides which tools to call and in what order, rather than following a fixed pipeline — it can stop early if one source is conclusive, or gather more evidence if the picture is ambiguous.
- **Graceful degradation:** Every tool call and every Gemini call is wrapped in error handling — a failed tool or malformed model response returns `UNCERTAIN` instead of crashing the request.
- **Classical CV for satellite analysis:** Uses Canny edge detection + Hough Line Transform for road-like feature detection — a defensible, working technique given hackathon time constraints, in place of a trained deep-learning segmentation model.

## Known Limitations

- Satellite tool uses a CV heuristic, not a trained road-segmentation model
- Currently runs locally only (not deployed)
- `google.generativeai` SDK is deprecated by Google (functional, pending migration to `google.genai`)
-
