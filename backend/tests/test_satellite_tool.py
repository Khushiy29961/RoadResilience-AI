import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.satellite_tool import get_satellite_evidence

lat, lon = 28.6139, 77.2090   # same sample coordinates as before

result = get_satellite_evidence(lat, lon, radius_m=200)

print("Result:")
print(result)