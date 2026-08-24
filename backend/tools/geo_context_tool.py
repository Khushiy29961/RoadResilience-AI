import requests


def get_geo_context(lat: float, lon: float, radius_m: int = 200) -> dict:
    """
    Checks for vegetation, water bodies, and buildings near a given lat/lon
    using OpenStreetMap's Overpass API. This helps explain WHY a road might
    be missing from the extracted map (e.g. hidden under trees).
    """
    query = f"""
    [out:json];
    (
      way(around:{radius_m},{lat},{lon})["natural"="water"];
      way(around:{radius_m},{lat},{lon})["building"];
      way(around:{radius_m},{lat},{lon})["landuse"="forest"];
      way(around:{radius_m},{lat},{lon})["natural"="wood"];
    );
    out body;
    """

    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "RoadResilienceAI/1.0 (student hackathon project)",
            },
            timeout=60,
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        tags_seen = [el.get("tags", {}) for el in elements]

        has_forest = any(
            t.get("landuse") == "forest" or t.get("natural") == "wood"
            for t in tags_seen
        )

        return {
            "vegetation_density": "high" if has_forest else "low",
            "has_water_barrier": any(t.get("natural") == "water" for t in tags_seen),
            "has_building_overlap": any("building" in t for t in tags_seen),
            "terrain_note": None,
        }

    except Exception as e:
        return {
            "error": str(e),
            "vegetation_density": None,
            "has_water_barrier": False,
            "has_building_overlap": False,
            "terrain_note": None,
        }