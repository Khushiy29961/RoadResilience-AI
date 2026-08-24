import osmnx as ox
from shapely.geometry import Point


def check_road_network(lat: float, lon: float, radius_m: int = 200) -> dict:
    """
    Checks existing mapped road segments near a given lat/lon.
    Returns nearby road segments and whether a connection already exists in OSM data.
    """
    try:
        # Get the drivable road network graph around the point
        G = ox.graph_from_point((lat, lon), dist=radius_m, network_type="drive")

        # Convert graph edges (roads) into a GeoDataFrame
        edges = ox.graph_to_gdfs(G, nodes=False)

        # Filter to roads actually close to our point (rough distance filter)
        point = Point(lon, lat)
        nearby = edges[edges.geometry.distance(point) < (radius_m / 111000)]

        segments = nearby[["name", "highway"]].fillna("unknown").to_dict("records")

        return {
            "nearby_segments": segments,
            "connection_exists_in_data": len(segments) > 0,
        }

    except Exception as e:
        # Graceful failure — agent can still reason with partial evidence
        return {
            "error": str(e),
            "nearby_segments": [],
            "connection_exists_in_data": False,
        }