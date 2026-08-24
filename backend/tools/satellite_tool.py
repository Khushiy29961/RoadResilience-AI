import numpy as np
import cv2
import pystac_client
import planetary_computer
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds


def get_satellite_evidence(lat: float, lon: float, radius_m: int = 200) -> dict:
    """
    Fetches a real Sentinel-2 satellite image around the given lat/lon,
    runs edge/line detection to look for road-like features, and returns
    structured evidence about whether a road likely continues through
    the suspected gap.
    """
    try:
        # --- 1. Search for a recent, low-cloud Sentinel-2 image covering this point ---
        catalog = pystac_client.Client.open(
            "https://planetarycomputer.microsoft.com/api/stac/v1",
            modifier=planetary_computer.sign_inplace,
        )

        # Small bounding box around the point (roughly radius_m, converted to degrees)
        deg_buffer = (radius_m / 111000) * 2  # rough conversion, generous buffer
        bbox = [lon - deg_buffer, lat - deg_buffer, lon + deg_buffer, lat + deg_buffer]

        search = catalog.search(
            collections=["sentinel-2-l2a"],
            bbox=bbox,
            query={"eo:cloud_cover": {"lt": 20}},
            sortby="-datetime",
            max_items=1,
        )
        items = list(search.items())

        if not items:
            return {
                "road_detected": False,
                "road_continuation": False,
                "confidence": 0.0,
                "possible_obstruction": "no_imagery_available",
            }

        item = items[0]

        # --- 2. Open the visual (true color) band and read a small window around the point ---
        asset_href = item.assets["visual"].href

        with rasterio.open(asset_href) as src:
            # Convert our lat/lon bbox into the image's own coordinate system
            left, bottom, right, top = transform_bounds(
                "EPSG:4326", src.crs, bbox[0], bbox[1], bbox[2], bbox[3]
            )
            window = from_bounds(left, bottom, right, top, transform=src.transform)
            img = src.read([1, 2, 3], window=window)  # RGB bands

        # img shape: (3, height, width) -> convert to (height, width, 3) for OpenCV
        img = np.transpose(img, (1, 2, 0)).astype(np.uint8)

        if img.size == 0:
            return {
                "road_detected": False,
                "road_continuation": False,
                "confidence": 0.0,
                "possible_obstruction": "image_crop_failed",
            }

        # --- 3. Road-like feature detection using classical CV ---
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)

        # Hough Line Transform: detect straight line segments (road-like structures)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=40, minLineLength=20, maxLineGap=10
        )

        num_lines = 0 if lines is None else len(lines)
        road_detected = num_lines >= 2  # heuristic: need multiple aligned line segments

        # Confidence heuristic based on how many line segments were found
        confidence = min(0.95, 0.3 + (num_lines * 0.05)) if road_detected else 0.15

        return {
            "road_detected": road_detected,
            "road_continuation": road_detected,
            "confidence": round(confidence, 2),
            "possible_obstruction": None if road_detected else "unclear_imagery",
        }

    except Exception as e:
        return {
            "error": str(e),
            "road_detected": False,
            "road_continuation": False,
            "confidence": 0.0,
            "possible_obstruction": "tool_error",
        }