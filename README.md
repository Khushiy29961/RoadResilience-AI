# RoadResilience AI

> AI-powered discovery and recovery of hidden road connections from incomplete satellite maps.

## Problem Statement

Satellite-based road extraction often produces incomplete or disconnected road maps because of vegetation, shadows, buildings, or poor image quality. A gap in an extracted road map does not necessarily mean a real road connection is absent.

**Core problem:** Given a suspected gap between road segments, determine whether a real road connection is likely present but missing from the extracted map.

## Solution

RoadResilience AI is an **evidence-fusion system** that investigates suspected road gaps using multiple independent sources of information:

- **Satellite imagery** analysed with computer vision
- **Existing road-network data** from OpenStreetMap
- **Geographic context** such as vegetation, water, and buildings

An **AI agent powered by Google Gemini** decides which sources to consult, reasons over the combined evidence, and returns a verdict with a confidence score and the evidence behind it.

## Features

- Agentic investigation: Gemini chooses which tools to call and in what order through function calling
- Early stopping when one source is conclusive, and more evidence gathering when the picture is ambiguous
- Satellite road-feature detection using Canny edge detection and the Hough Line Transform
- Road-network lookup from OpenStreetMap
- Geographic context checks (vegetation, water, buildings)
- Explainable output: every verdict comes with its evidence and the steps taken
- Graceful degradation: a failed tool or malformed model response returns `UNCERTAIN` instead of crashing

## Tech Stack

| Area | Technology |
|---|---|
| Language | Python 3.13 |
| Web framework | FastAPI + Uvicorn |
| AI / agent reasoning | Google Gemini (`gemini-3.5-flash`) via function calling |
| Satellite data | Microsoft Planetary Computer (Sentinel-2 L2A imagery) |
| Image processing | Rasterio, OpenCV (Canny edge detection + Hough Line Transform) |
| Road network data | OpenStreetMap via OSMnx |
| Geographic context | OpenStreetMap Overpass API |
| Geospatial processing | GeoPandas, Shapely |
| Validation | Pydantic |
| Frontend | HTML, CSS, JavaScript |

## Architecture

```
Frontend → POST /investigate {lat, lon, radius_m}
    ↓
FastAPI (main.py) → run_agent()
    ↓
Gemini Agent (agent.py) — decides which tools to call
    ↓
┌──────────────────┬──────────────────────┬──────────────────────┐
│ Satellite Tool   │ Road Network Tool    │ Geo Context Tool     │
│ (imagery + CV    │ (OSM road segments)  │ (vegetation, water,  │
│  road detection) │                      │  buildings)          │
└──────────────────┴──────────────────────┴──────────────────────┘
    ↓
Gemini reasons over the combined evidence
    ↓
Final verdict: {final_answer, confidence, evidence, steps}
```

## Project Structure

```
backend/
├── main.py                 # FastAPI app, /investigate endpoint
├── agent.py                # Gemini agent loop
├── schemas.py              # Pydantic request/response models
├── config.py               # Loads GEMINI_API_KEY from .env
├── tools/
│   ├── satellite_tool.py       # Satellite imagery + CV road detection
│   ├── road_network_tool.py    # OSM road network lookup
│   └── geo_context_tool.py     # Vegetation/water/building context
├── tests/                  # Standalone test scripts per tool
└── requirements.txt

Frontend: index.html, app.js, style.css
```

## API

### `POST /investigate`

**Request**

```json
{
  "lat": 28.6139,
  "lon": 77.2090,
  "radius_m": 200
}
```

**Response**

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

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>/backend
   ```

2. **Create and activate a virtual environment**

   ```bash
   python -m venv venv
   venv\Scripts\activate        # Windows
   # source venv/bin/activate   # macOS / Linux
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Add your Gemini API key**

   Create a `.env` file inside `backend/`:

   ```
   GEMINI_API_KEY=your_api_key_here
   ```

   Never commit this file. Keep `.env` in your `.gitignore`.

5. **Run the server**

   ```bash
   uvicorn main:app --reload
   ```

   The server runs at `http://127.0.0.1:8000`.

6. **Open the frontend**

   With the backend running, open `index.html` in your browser.

## Key Design Decisions

- **Agentic approach:** Gemini dynamically decides which tools to call and in what order, rather than following a fixed pipeline. It can stop early if one source is conclusive, or gather more evidence if the picture is ambiguous.
- **Graceful degradation:** Every tool call and every Gemini call is wrapped in error handling, so a failed tool or malformed model response returns `UNCERTAIN` instead of crashing the request.
- **Classical CV for satellite analysis:** Canny edge detection and the Hough Line Transform detect road-like features. This is a working, defensible technique given the hackathon's time constraints, used in place of a trained deep-learning segmentation model.

## Known Limitations

- The satellite tool uses a computer-vision heuristic, not a trained road-segmentation model
- Currently runs locally only (not deployed)
- The `google.generativeai` SDK is deprecated by Google (still functional, migration to `google.genai` is pending)

## Future Work

- Replace the CV heuristic with a trained road-segmentation model
- Migrate to the `google.genai` SDK
- Deploy the backend and frontend
