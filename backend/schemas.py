from pydantic import BaseModel
from typing import Optional, List


class InvestigateRequest(BaseModel):
    lat: float
    lon: float
    radius_m: int = 200   # search radius around the point, in meters


class SatelliteEvidence(BaseModel):
    road_detected: bool
    road_continuation: bool
    confidence: float
    possible_obstruction: Optional[str] = None


class RoadNetworkEvidence(BaseModel):
    nearby_segments: List[dict]
    connection_exists_in_data: bool


class GeoContextEvidence(BaseModel):
    vegetation_density: Optional[str] = None
    has_water_barrier: bool = False
    has_building_overlap: bool = False
    terrain_note: Optional[str] = None


class AgentResult(BaseModel):
    final_answer: str        # "LIKELY_EXISTS" | "UNLIKELY" | "UNCERTAIN"
    confidence: float
    evidence: List[str]
    steps: List[str]