from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

from schemas import InvestigateRequest
from agent import run_agent

app = FastAPI(
    title="RoadResilience AI",
    description="Investigates suspected gaps in extracted road maps using satellite imagery, road network data, and geographic context.",
)

# Allow requests from any frontend (fine for hackathon demo; restrict this in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"status": "RoadResilience AI backend is running"}


@app.post("/investigate")
def investigate(req: InvestigateRequest):
    try:
        result = run_agent(req.lat, req.lon, req.radius_m)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")