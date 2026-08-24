import sys
import os

# Allow imports from the parent project folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.geo_context_tool import get_geo_context

# Same sample coordinates as before — near India Gate, New Delhi
lat, lon = 28.6139, 77.2090

result = get_geo_context(lat, lon, radius_m=200)

print("Result:")
print(result)