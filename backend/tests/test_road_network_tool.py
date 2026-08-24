import sys
import os

# Allow imports from the parent project folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.road_network_tool import check_road_network

# Sample coordinates — somewhere with known roads (e.g. a spot in a city)
# Replace with your actual test location later
lat, lon = 28.6139, 77.2090   # example: New Delhi

result = check_road_network(lat, lon, radius_m=200)

print("Result:")
print(result)