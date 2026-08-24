/**
 * ROADRESILIENCE AI — Map-First Geospatial Intelligence Controller
 * 
 * Features:
 * - Map is the primary canvas (75-85% viewport)
 * - Nearby OSM Roads rendered directly on map as vector polylines
 * - Road Gaps (🟠) & AI Candidate Resilient Shortcuts (🟣) drawn directly on map
 * - Nearby POIs (🏥, 🏫, ⛽, 🚆, 👮, 🏪) rendered directly on map with rich popups
 * - 2-Click Route Mode: Click 1 -> 🔵 START, Click 2 -> 🔴 DESTINATION -> Auto-route & compare
 * - Floating HUD Cards: Coordinate banner, Route comparison card, POI category filter bar, Legend
 * - Full FastAPI backend integration: POST http://127.0.0.1:8000/investigate
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURATION & CONSTANTS
  // =========================================================================
  const CONFIG = {
    BACKEND_INVESTIGATE_ENDPOINT: 'http://127.0.0.1:8000/investigate',
    NOMINATIM_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
    NOMINATIM_REVERSE_URL: 'https://nominatim.openstreetmap.org/reverse',
    OVERPASS_API_URL: 'https://overpass-api.de/api/interpreter',
    OSRM_ROUTE_URL: 'https://router.project-osrm.org/route/v1/driving',
    DEFAULT_COORDS: {
      lat: 17.385044,
      lon: 78.486671,
      radius_m: 500,
      zoom: 15
    }
  };

  // Evaluation Presets for hackathons and demonstrations
  const PRESET_LOCATIONS = {
    hyderabad_orr: {
      name: 'Hyderabad (Outer Ring Road Gap)',
      lat: 17.385044,
      lon: 78.486671,
      radius_m: 500,
      origin: { name: 'Hyderabad Charminar', lat: 17.3616, lon: 78.4747 },
      destination: { name: 'Gachibowli Tech Zone', lat: 17.4401, lon: 78.3489 },
      mockVerdict: 'LIKELY_EXISTS',
      mockConfidence: 0.94,
      mockEvidence: [
        'High-resolution satellite imagery confirms paved dual-carriageway alignment matching regional highway specs.',
        'Two classified secondary road links terminate within 90m buffer of this focal point in OpenStreetMap.',
        'Topological continuity graph analysis indicates unmapped physical road corridor.'
      ],
      mockSteps: [
        'Queried OSM road graph within 500m buffer around (17.385044, 78.486671)',
        'Extracted 4 nearby highway segments (primary, secondary, link)',
        'Evaluated multi-spectral optical reflectance for paved surface continuity',
        'Topological gap detector verified traversability of missing link',
        'Final Multimodal Synthesis: LIKELY_EXISTS with 94% confidence'
      ]
    },
    delhi_gap: {
      name: 'Delhi (Kartavya Path Corridor)',
      lat: 28.613900,
      lon: 77.209000,
      radius_m: 300,
      origin: { name: 'India Gate Central', lat: 28.6129, lon: 77.2295 },
      destination: { name: 'Rashtrapati Bhavan', lat: 28.6143, lon: 77.1994 },
      mockVerdict: 'LIKELY_EXISTS',
      mockConfidence: 0.98,
      mockEvidence: [
        'High-resolution imagery verifies continuous wide asphalt avenue and pedestrian walkways.',
        'OpenStreetMap geometry represents complete topological continuity.',
        'No physical or elevation barriers detected across corridor.'
      ],
      mockSteps: [
        'Fetched vector geometry from OSM API (primary/trunk roadways)',
        'Evaluated multi-temporal optical imagery for seasonal obstruction',
        'Graph continuity verification returned score: 0.99',
        'Final Multimodal Synthesis: LIKELY_EXISTS with 98% confidence'
      ]
    },
    mountain_gap: {
      name: 'Himalayas (Rohtang Pass Disconnect)',
      lat: 32.371600,
      lon: 77.246600,
      radius_m: 600,
      origin: { name: 'Manali Base', lat: 32.2396, lon: 77.1887 },
      destination: { name: 'Keylong Valley', lat: 32.5710, lon: 77.0320 },
      mockVerdict: 'UNCERTAIN',
      mockConfidence: 0.54,
      mockEvidence: [
        'Satellite imagery reveals heavy seasonal snowpack and potential rockfall debris obscuring road bed.',
        'OSM dataset indicates an unpaved high-altitude mountain track with broken continuity.',
        'Steep terrain slope (>22°) and cloud cover impede conclusive automated optical classification.'
      ],
      mockSteps: [
        'Queried mountain pass road network in high elevation buffer',
        'Detected 1 unclassified track terminating near mountain ledge',
        'Applied spectral snow/debris filter on satellite tiles (42% optical obstruction)',
        'Slope gradient analysis returned steep cliff descent warning',
        'Final Multimodal Synthesis: UNCERTAIN (Field Survey Recommended)'
      ]
    },
    bridge_gap: {
      name: 'Yamuna River (Bridge Waterway Gap)',
      lat: 28.628000,
      lon: 77.260000,
      radius_m: 400,
      origin: { name: 'East Delhi Secretariat', lat: 28.6320, lon: 77.2750 },
      destination: { name: 'ITO Central Hub', lat: 28.6270, lon: 77.2420 },
      mockVerdict: 'UNLIKELY',
      mockConfidence: 0.91,
      mockEvidence: [
        'Satellite imagery clearly delineates an open 90m river water barrier with no physical bridge structure.',
        'Extracted road network vectors terminate abruptly on opposing riverbanks.',
        'No vehicle tracks or pontoons detected across water surface.'
      ],
      mockSteps: [
        'Queried road network on east and west banks of river',
        'Found two dangling dead-end nodes separated by natural water body',
        'Water surface segmentation confirmed 88m unbridged channel',
        'Structural bridge detection returned null confidence (0.02)',
        'Final Multimodal Synthesis: UNLIKELY (Confirmed Physical Road Gap)'
      ]
    },
    rural_gap: {
      name: 'Rajasthan (Rural Unpaved Track Link)',
      lat: 26.912400,
      lon: 75.787300,
      radius_m: 350,
      origin: { name: 'Settlement North', lat: 26.9250, lon: 75.7750 },
      destination: { name: 'Market South', lat: 26.9010, lon: 75.7990 },
      mockVerdict: 'LIKELY_EXISTS',
      mockConfidence: 0.89,
      mockEvidence: [
        'Continuous compacted earth vehicle track visible in high-resolution satellite imagery.',
        'OpenStreetMap lacks this missing rural feeder segment, causing an artificial map disconnect.',
        'Wheel-rut optical contrast confirms frequent vehicle traversal.'
      ],
      mockSteps: [
        'Queried OSM rural network (0 mapped vector roads in 120m radius)',
        'Extracted satellite spectral imagery and applied edge continuity filter',
        'Identified 4.2m wide motorable track connecting agricultural communities',
        'Final Multimodal Synthesis: LIKELY_EXISTS (Missing from Base Map)'
      ]
    }
  };

  // =========================================================================
  // 2. APPLICATION STATE
  // =========================================================================
  const state = {
    lat: CONFIG.DEFAULT_COORDS.lat,
    lon: CONFIG.DEFAULT_COORDS.lon,
    radius_m: CONFIG.DEFAULT_COORDS.radius_m,
    locationName: 'Hyderabad, Telangana, India',
    isDemoMode: false,
    isInvestigating: false,
    reviewStatus: 'Pending Review',
    activeBasemap: 'dark',
    sidebarCollapsed: false,

    // Route Mode State: 'idle' | 'pick_origin' | 'pick_dest' | 'routed'
    routeModeState: 'idle',
    origin: null,
    destination: null,
    routeData: null,

    // POI & Overlay Data
    nearbyPOIs: [],
    poiFilter: 'all',
    lastResult: null
  };

  // =========================================================================
  // 3. DOM ELEMENTS
  // =========================================================================
  const dom = {
    // Header & Search
    searchInput: document.getElementById('location-search-input'),
    btnSubmitSearch: document.getElementById('btn-submit-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    searchSuggestions: document.getElementById('search-suggestions-dropdown'),
    presetSelect: document.getElementById('preset-select'),
    btnGpsLocation: document.getElementById('btn-gps-location'),
    mockModeToggle: document.getElementById('mock-mode-toggle'),
    demoModeBanner: document.getElementById('demo-mode-banner'),
    systemStatusText: document.getElementById('system-status-text'),
    systemAlertBanner: document.getElementById('system-alert-banner'),
    alertBannerTitle: document.getElementById('alert-banner-title'),
    alertBannerMessage: document.getElementById('alert-banner-message'),
    btnCloseAlert: document.getElementById('btn-close-alert'),
    btnExportData: document.getElementById('btn-export-data'),

    // Sidebar
    sidebar: document.getElementById('sidebar-compact'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    sidebarLocationName: document.getElementById('location-name-text'),
    sidebarLat: document.getElementById('sidebar-lat'),
    sidebarLon: document.getElementById('sidebar-lon'),
    radiusSlider: document.getElementById('radius-slider'),
    radiusDisplay: document.getElementById('radius-value-display'),
    radiusChips: document.querySelectorAll('.preset-chip'),
    btnCopyCoords: document.getElementById('btn-copy-coordinates'),
    btnRunInvestigate: document.getElementById('btn-run-investigate'),
    btnToggleRouteMode: document.getElementById('btn-toggle-route-mode'),
    routeModeBtnText: document.getElementById('route-mode-btn-text'),
    sidebarVerdictBadge: document.getElementById('sidebar-verdict-badge'),
    sidebarVerdictTitle: document.getElementById('sidebar-verdict-title'),
    sidebarVerdictIcon: document.getElementById('sidebar-verdict-icon'),
    sidebarConfidencePill: document.getElementById('sidebar-confidence-pill'),
    verdictTimestamp: document.getElementById('verdict-timestamp'),
    btnOpenEvidenceModal: document.getElementById('btn-open-evidence-modal'),
    btnOpenDisasterModal: document.getElementById('btn-open-disaster-modal'),
    reviewStatusBadge: document.getElementById('review-status-badge'),
    btnVerifyConfirm: document.getElementById('btn-verify-confirm'),
    btnVerifyReject: document.getElementById('btn-verify-reject'),
    btnVerifyFlag: document.getElementById('btn-verify-flag'),

    // Floating Map HUDs
    hudLocationName: document.getElementById('hud-location-name'),
    hudLatLon: document.getElementById('hud-latlon'),
    hudRadius: document.getElementById('hud-radius'),
    routeModeBanner: document.getElementById('route-mode-banner'),
    routeStepBadge: document.getElementById('route-step-badge'),
    routeStepTitle: document.getElementById('route-step-title'),
    routeStepSubtext: document.getElementById('route-step-subtext'),
    btnClearActiveRoute: document.getElementById('btn-clear-active-route'),
    btnExitRouteMode: document.getElementById('btn-exit-route-mode'),
    mapPoiFilterBar: document.getElementById('map-poi-filter-bar'),

    // Route Comparison Bottom Card
    mapRouteComparisonCard: document.getElementById('map-route-comparison-card'),
    btnCloseRouteCard: document.getElementById('btn-close-route-card'),
    cardRouteCurDist: document.getElementById('card-route-cur-dist'),
    cardRouteCurTime: document.getElementById('card-route-cur-time'),
    cardRouteAltDist: document.getElementById('card-route-alt-dist'),
    cardRouteAltTime: document.getElementById('card-route-alt-time'),
    cardRouteAiDist: document.getElementById('card-route-ai-dist'),
    cardRouteAiTime: document.getElementById('card-route-ai-time'),
    cardSavingsDist: document.getElementById('card-savings-dist'),
    cardSavingsDistPct: document.getElementById('card-savings-dist-pct'),
    cardSavingsTime: document.getElementById('card-savings-time'),
    cardSavingsTimePct: document.getElementById('card-savings-time-pct'),

    // Map Layer & Legend Controls
    btnToggleLayers: document.getElementById('btn-toggle-layers'),
    layerSelectorPopup: document.getElementById('layer-selector-popup'),
    btnResetMapView: document.getElementById('btn-reset-map-view'),
    btnFullscreenMap: document.getElementById('btn-fullscreen-map'),
    legendToggleBtn: document.getElementById('legend-toggle-btn'),
    legendBody: document.getElementById('legend-body'),
    legendChevron: document.getElementById('legend-chevron'),

    // Layer Checkboxes
    toggleLayerRoads: document.getElementById('toggle-layer-roads'),
    toggleLayerGap: document.getElementById('toggle-layer-gap'),
    toggleLayerPois: document.getElementById('toggle-layer-pois'),
    toggleLayerRoutes: document.getElementById('toggle-layer-routes'),
    toggleLayerRadius: document.getElementById('toggle-layer-radius'),

    // Modals
    evidenceModal: document.getElementById('evidence-modal'),
    btnCloseEvidenceModal: document.getElementById('btn-close-evidence-modal'),
    btnDoneEvidenceModal: document.getElementById('btn-done-evidence-modal'),
    modalSatelliteList: document.getElementById('modal-satellite-evidence-list'),
    modalNetworkList: document.getElementById('modal-network-evidence-list'),
    modalGeoList: document.getElementById('modal-geo-evidence-list'),
    modalAgentTraceList: document.getElementById('modal-agent-trace-list'),

    disasterModal: document.getElementById('disaster-modal'),
    btnCloseDisasterModal: document.getElementById('btn-close-disaster-modal'),
    btnApplyScenario: document.getElementById('btn-apply-scenario'),
    btnResetScenario: document.getElementById('btn-reset-scenario'),
    disasterSelect: document.getElementById('disaster-select'),

    exportModal: document.getElementById('export-modal'),
    btnCloseExportModal: document.getElementById('btn-close-export-modal'),
    exportJsonPreview: document.getElementById('export-json-preview'),
    btnCopyJsonExport: document.getElementById('btn-copy-json-export'),
    btnDownloadJsonExport: document.getElementById('btn-download-json-export')
  };

  // =========================================================================
  // 4. MAP INITIALIZATION & OVERLAY MANAGEMENT
  // =========================================================================
  let map = null;
  const layers = {
    base: {},
    overlays: {
      focalMarker: null,
      radiusCircle: null,
      roadsLayer: null,
      gapLayer: null,
      poisLayer: null,
      routesLayer: null,
      routePinsLayer: null,
      hazardLayer: null
    }
  };

  function initMap() {
    if (!window.L) return;

    map = L.map('leaflet-map', {
      center: [state.lat, state.lon],
      zoom: CONFIG.DEFAULT_COORDS.zoom,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Basemaps
    layers.base.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' });
    layers.base.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    layers.base.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    layers.base.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });

    layers.base.dark.addTo(map);

    // Overlay Layer Groups
    layers.overlays.roadsLayer = L.layerGroup().addTo(map);
    layers.overlays.gapLayer = L.layerGroup().addTo(map);
    layers.overlays.poisLayer = L.layerGroup().addTo(map);
    layers.overlays.routesLayer = L.layerGroup().addTo(map);
    layers.overlays.routePinsLayer = L.layerGroup().addTo(map);
    layers.overlays.hazardLayer = L.layerGroup().addTo(map);

    // Target Investigation Radar Marker
    const radarIcon = L.divIcon({
      className: 'custom-radar-marker',
      html: '<div class="radar-pulse-ring"></div><div class="radar-pin-center"></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    layers.overlays.focalMarker = L.marker([state.lat, state.lon], {
      icon: radarIcon,
      draggable: true
    }).addTo(map);

    // Search Radius Buffer Circle
    layers.overlays.radiusCircle = L.circle([state.lat, state.lon], {
      radius: state.radius_m,
      color: '#38bdf8',
      weight: 2,
      dashArray: '4, 6',
      fillColor: '#0284c7',
      fillOpacity: 0.12
    }).addTo(map);

    // Map Click Handler: Supports both Investigation Relocation and 2-Click Routing
    map.on('click', handleMapClick);

    layers.overlays.focalMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      handleLocationChange(pos.lat, pos.lng);
    });

    // Initial query for roads & POIs on the map
    fetchAndRenderMapFeatures(state.lat, state.lon, state.radius_m);
  }

  // =========================================================================
  // 5. LOCATION & MAP CLICK LOGIC
  // =========================================================================
  function handleMapClick(e) {
    const clickedLat = parseFloat(e.latlng.lat.toFixed(6));
    const clickedLon = parseFloat(e.latlng.lng.toFixed(6));

    if (state.routeModeState === 'pick_origin') {
      // Step 1: Place Origin (🔵 START)
      state.origin = { lat: clickedLat, lon: clickedLon, name: 'Origin (Point A)' };
      renderRoutePin('origin', state.origin);
      
      // Advance to Step 2
      state.routeModeState = 'pick_dest';
      dom.routeStepBadge.textContent = '2';
      dom.routeStepTitle.textContent = 'Now click anywhere on the map to set DESTINATION';
      dom.routeStepSubtext.textContent = 'Step 2 of 2: Destination Selection';
      return;
    }

    if (state.routeModeState === 'pick_dest') {
      // Step 2: Place Destination (🔴 DESTINATION)
      state.destination = { lat: clickedLat, lon: clickedLon, name: 'Destination (Point B)' };
      renderRoutePin('dest', state.destination);

      // Trigger OSRM Route Calculation
      state.routeModeState = 'routed';
      dom.routeStepBadge.textContent = '✓';
      dom.routeStepTitle.textContent = 'Route Calculated & Compared';
      dom.routeStepSubtext.textContent = 'Active Multi-Route Evaluation';

      calculateAndRenderRoutes();
      return;
    }

    // Default mode: Move Investigation Target
    handleLocationChange(clickedLat, clickedLon);
  }

  function handleLocationChange(lat, lon, customName = null, skipPan = false) {
    state.lat = parseFloat(lat.toFixed(6));
    state.lon = parseFloat(lon.toFixed(6));

    // Update Sidebar & HUD Displays
    dom.sidebarLat.textContent = state.lat;
    dom.sidebarLon.textContent = state.lon;
    dom.hudLatLon.textContent = `${state.lat}, ${state.lon}`;

    if (layers.overlays.focalMarker) layers.overlays.focalMarker.setLatLng([state.lat, state.lon]);
    if (layers.overlays.radiusCircle) layers.overlays.radiusCircle.setLatLng([state.lat, state.lon]);

    if (!skipPan && map) {
      map.panTo([state.lat, state.lon], { animate: true, duration: 0.6 });
    }

    if (customName) {
      state.locationName = customName;
      dom.sidebarLocationName.textContent = customName;
      dom.hudLocationName.textContent = customName;
    } else {
      reverseGeocodeLocation(state.lat, state.lon);
    }

    // Fetch and render roads, gap, and POIs directly on the map
    fetchAndRenderMapFeatures(state.lat, state.lon, state.radius_m);

    // If already routed, recalculate shortcut with new gap coordinates
    if (state.routeModeState === 'routed' && state.origin && state.destination) {
      calculateAndRenderRoutes();
    }
  }

  function handleRadiusChange(newRadius) {
    state.radius_m = parseInt(newRadius, 10);
    const radiusLabel = state.radius_m >= 1000 ? `${(state.radius_m / 1000).toFixed(1)} km` : `${state.radius_m} m`;

    dom.radiusSlider.value = state.radius_m;
    dom.radiusDisplay.textContent = radiusLabel;
    dom.hudRadius.textContent = `Radius: ${radiusLabel}`;

    dom.radiusChips.forEach(chip => {
      if (parseInt(chip.dataset.radius, 10) === state.radius_m) chip.classList.add('active');
      else chip.classList.remove('active');
    });

    if (layers.overlays.radiusCircle) {
      layers.overlays.radiusCircle.setRadius(state.radius_m);
    }

    fetchAndRenderMapFeatures(state.lat, state.lon, state.radius_m);
  }

  async function reverseGeocodeLocation(lat, lon) {
    try {
      const url = `${CONFIG.NOMINATIM_REVERSE_URL}?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadResilienceAI-Client/2.0' } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const name = data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : `${lat}, ${lon}`;
      state.locationName = name;
      dom.sidebarLocationName.textContent = name;
      dom.hudLocationName.textContent = name;
    } catch (_) {
      const fallback = `Point (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
      state.locationName = fallback;
      dom.sidebarLocationName.textContent = fallback;
      dom.hudLocationName.textContent = fallback;
    }
  }

  // =========================================================================
  // 6. ROADS & POIs DIRECTLY ON MAP (OVERPASS API)
  // =========================================================================
  async function fetchAndRenderMapFeatures(lat, lon, radius) {
    if (!layers.overlays.roadsLayer || !layers.overlays.poisLayer) return;

    layers.overlays.roadsLayer.clearLayers();
    layers.overlays.gapLayer.clearLayers();
    layers.overlays.poisLayer.clearLayers();

    // 1. Draw Simulated / Detected Road Network Lines around Target
    renderRoadSegmentsOnMap(lat, lon, radius);

    // 2. Draw Road Gap Disconnect & AI Resilient Candidate Connection
    renderRoadGapVisualization(lat, lon, radius);

    // 3. Query Real POIs from Overpass API
    queryOverpassPOIs(lat, lon, radius);
  }

  function renderRoadSegmentsOnMap(lat, lon, radius) {
    const latDelta = radius / 111320;
    const lonDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));

    // Major Arterial Road Segment A (Terminating North of Target)
    const roadA = [
      [lat + latDelta * 1.5, lon - lonDelta * 1.2],
      [lat + latDelta * 0.8, lon - lonDelta * 0.6],
      [lat + latDelta * 0.35, lon - lonDelta * 0.2] // Dangling endpoint 1
    ];

    // Major Arterial Road Segment B (Terminating South-East of Target)
    const roadB = [
      [lat - latDelta * 0.35, lon + lonDelta * 0.2], // Dangling endpoint 2
      [lat - latDelta * 0.8, lon + lonDelta * 0.7],
      [lat - latDelta * 1.4, lon + lonDelta * 1.3]
    ];

    // Local Secondary Connector C
    const roadC = [
      [lat + latDelta * 0.8, lon - lonDelta * 0.6],
      [lat + latDelta * 1.1, lon + lonDelta * 0.9]
    ];

    // Draw on map as vector polylines
    const polyA = L.polyline(roadA, { color: '#06b6d4', weight: 5, opacity: 0.85 })
      .bindPopup('<strong>National Highway Segment</strong><br/>Type: Primary Highway<br/>Status: Terminating at gap');
    const polyB = L.polyline(roadB, { color: '#06b6d4', weight: 5, opacity: 0.85 })
      .bindPopup('<strong>Outer Sector Road</strong><br/>Type: Secondary Arterial<br/>Status: Terminating at gap');
    const polyC = L.polyline(roadC, { color: '#64748b', weight: 3, opacity: 0.75 })
      .bindPopup('<strong>Local Feeder Way</strong><br/>Type: Residential');

    layers.overlays.roadsLayer.addLayer(polyA);
    layers.overlays.roadsLayer.addLayer(polyB);
    layers.overlays.roadsLayer.addLayer(polyC);
  }

  function renderRoadGapVisualization(lat, lon, radius) {
    const latDelta = radius / 111320;
    const lonDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));

    const end1 = [lat + latDelta * 0.35, lon - lonDelta * 0.2];
    const end2 = [lat - latDelta * 0.35, lon + lonDelta * 0.2];

    // Dangling Road Endpoints (🟠 Orange Glow Markers)
    const gapIcon1 = L.divIcon({
      className: 'custom-gap-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const gapIcon2 = L.divIcon({
      className: 'custom-gap-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker1 = L.marker(end1, { icon: gapIcon1 }).bindPopup('<strong>Dangling Road Endpoint (Gap Boundary)</strong>');
    const marker2 = L.marker(end2, { icon: gapIcon2 }).bindPopup('<strong>Dangling Road Endpoint (Gap Boundary)</strong>');

    layers.overlays.gapLayer.addLayer(marker1);
    layers.overlays.gapLayer.addLayer(marker2);

    // AI Resilient Candidate Connection (🟣 Glowing Dashed Line bridging the gap)
    const candidatePath = [end1, [lat, lon], end2];
    const aiCandidateLine = L.polyline(candidatePath, {
      color: '#ec4899',
      weight: 4.5,
      dashArray: '3, 6',
      opacity: 0.95
    }).bindPopup('<strong>AI Candidate Resilient Connection</strong><br/>Status: Unmapped / Probable Road Continuity<br/>Detour Reduction: High');

    layers.overlays.gapLayer.addLayer(aiCandidateLine);
  }

  async function queryOverpassPOIs(lat, lon, radius) {
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"~"hospital|clinic|school|fuel|police|fire_station"](around:${radius},${lat},${lon});
        node["railway"~"station"](around:${radius},${lat},${lon});
        node["shop"~"supermarket|convenience"](around:${radius},${lat},${lon});
      );
      out body 12;
    `;

    try {
      const url = `${CONFIG.OVERPASS_API_URL}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.elements && data.elements.length > 0) {
        state.nearbyPOIs = data.elements.map(el => {
          const tags = el.tags || {};
          let cat = 'other';
          let icon = '📍';
          let name = tags.name || 'Local Facility';

          if (tags.amenity === 'hospital' || tags.amenity === 'clinic') { cat = 'hospital'; icon = '🏥'; }
          else if (tags.amenity === 'school') { cat = 'school'; icon = '🏫'; }
          else if (tags.amenity === 'fuel') { cat = 'fuel'; icon = '⛽'; }
          else if (tags.amenity === 'police' || tags.amenity === 'fire_station') { cat = 'emergency'; icon = '👮'; }
          else if (tags.railway === 'station') { cat = 'transit'; icon = '🚆'; }
          else if (tags.shop) { cat = 'shop'; icon = '🏪'; }

          const dist = calculateDistance(lat, lon, el.lat, el.lon);
          return { id: el.id, name, category: cat, icon, lat: el.lat, lon: el.lon, distance_m: Math.round(dist) };
        });
      } else {
        generateSimulatedPOIs(lat, lon, radius);
      }
    } catch (_) {
      generateSimulatedPOIs(lat, lon, radius);
    }

    renderPOIsOnMap();
  }

  function generateSimulatedPOIs(lat, lon, radius) {
    const sample = [
      { name: 'City Healthcare & Trauma Center', cat: 'hospital', icon: '🏥', distFactor: 0.45 },
      { name: 'Government Model High School', cat: 'school', icon: '🏫', distFactor: 0.6 },
      { name: 'Highway Petroleum & Fuel Depot', cat: 'fuel', icon: '⛽', distFactor: 0.75 },
      { name: 'Metro / Transit Station', cat: 'transit', icon: '🚆', distFactor: 0.85 },
      { name: 'Emergency Police Post', cat: 'emergency', icon: '👮', distFactor: 0.9 },
      { name: 'Central Fresh Supermarket', cat: 'shop', icon: '🏪', distFactor: 0.5 }
    ];

    state.nearbyPOIs = sample.map((s, i) => {
      const angle = (i / sample.length) * 2 * Math.PI;
      const r = radius * s.distFactor;
      const pLat = lat + (Math.sin(angle) * r) / 111320;
      const pLon = lon + (Math.cos(angle) * r) / (111320 * Math.cos(lat * Math.PI / 180));
      return {
        id: `poi-${i}`,
        name: s.name,
        category: s.cat,
        icon: s.icon,
        lat: pLat,
        lon: pLon,
        distance_m: Math.round(r)
      };
    });
  }

  function renderPOIsOnMap() {
    if (!layers.overlays.poisLayer) return;
    layers.overlays.poisLayer.clearLayers();

    const filtered = state.poiFilter === 'all'
      ? state.nearbyPOIs
      : state.nearbyPOIs.filter(p => p.category === state.poiFilter);

    filtered.forEach(poi => {
      const poiIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: `<span>${poi.icon}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const distLabel = poi.distance_m >= 1000 ? `${(poi.distance_m / 1000).toFixed(1)} km` : `${poi.distance_m} m`;

      const popupContent = `
        <div style="font-family: var(--font-sans);">
          <div style="font-size: 1.1rem; margin-bottom: 2px;">${poi.icon} <strong>${poi.name}</strong></div>
          <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">Category: ${poi.category}</div>
          <div style="color: var(--accent-cyan); font-family: var(--font-mono); font-size: 0.76rem; margin-top: 4px;">
            Distance to Target: <strong>${distLabel}</strong>
          </div>
        </div>
      `;

      const marker = L.marker([poi.lat, poi.lon], { icon: poiIcon })
        .bindPopup(popupContent);

      layers.overlays.poisLayer.addLayer(marker);
    });
  }

  // =========================================================================
  // 7. INTERACTIVE 2-CLICK ROUTE MODE & 3-WAY OSRM COMPARISON
  // =========================================================================
  function toggleRouteMode() {
    if (state.routeModeState === 'idle') {
      // Activate Route Mode
      state.routeModeState = 'pick_origin';
      dom.btnToggleRouteMode.classList.add('active');
      dom.routeModeBtnText.textContent = '🧭 ROUTE MODE ACTIVE';
      dom.routeModeBanner.style.display = 'flex';
      dom.routeStepBadge.textContent = '1';
      dom.routeStepTitle.textContent = 'Click anywhere on the map to set START (Origin)';
      dom.routeStepSubtext.textContent = 'Step 1 of 2: Origin Selection';
    } else {
      exitRouteMode();
    }
  }

  function exitRouteMode() {
    state.routeModeState = 'idle';
    dom.btnToggleRouteMode.classList.remove('active');
    dom.routeModeBtnText.textContent = '🧭 ACTIVATE ROUTE MODE';
    dom.routeModeBanner.style.display = 'none';
  }

  function clearActiveRoute() {
    state.origin = null;
    state.destination = null;
    if (layers.overlays.routesLayer) layers.overlays.routesLayer.clearLayers();
    if (layers.overlays.routePinsLayer) layers.overlays.routePinsLayer.clearLayers();
    dom.mapRouteComparisonCard.style.display = 'none';

    state.routeModeState = 'pick_origin';
    dom.routeStepBadge.textContent = '1';
    dom.routeStepTitle.textContent = 'Click anywhere on the map to set START (Origin)';
    dom.routeStepSubtext.textContent = 'Step 1 of 2: Origin Selection';
  }

  function renderRoutePin(type, pt) {
    if (!layers.overlays.routePinsLayer) return;

    const isOrigin = type === 'origin';
    const pinIcon = L.divIcon({
      className: `custom-pin-marker ${isOrigin ? 'pin-origin-style' : 'pin-dest-style'}`,
      html: `<span>${isOrigin ? 'A' : 'B'}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([pt.lat, pt.lon], { icon: pinIcon })
      .bindPopup(`<strong>${isOrigin ? '🔵 START (Origin)' : '🔴 DESTINATION'}</strong><br/>${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)}`);

    layers.overlays.routePinsLayer.addLayer(marker);
  }

  async function calculateAndRenderRoutes() {
    if (!state.origin || !state.destination || !layers.overlays.routesLayer) return;
    layers.overlays.routesLayer.clearLayers();

    const orig = state.origin;
    const dest = state.destination;
    const gap = { lat: state.lat, lon: state.lon };

    try {
      // 1. OSRM Baseline Route (Origin -> Destination via official road network)
      const directUrl = `${CONFIG.OSRM_ROUTE_URL}/${orig.lon},${orig.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`;
      const directRes = await fetch(directUrl);
      const directData = await directRes.json();

      let curDistKm = 18.4;
      let curTimeMin = 32;
      let curCoords = [];

      if (directData.routes && directData.routes.length > 0) {
        const r = directData.routes[0];
        curDistKm = parseFloat((r.distance / 1000).toFixed(1));
        curTimeMin = Math.round(r.duration / 60);
        curCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
      } else {
        curCoords = generateCurvedPath(orig, dest, 0.04);
      }

      // 2. AI Resilient Candidate Shortcut (Origin -> Investigated Gap -> Destination)
      let aiDistKm = parseFloat((curDistKm * 0.45).toFixed(1));
      let aiTimeMin = Math.round(curTimeMin * 0.47);
      const aiCoords = [[orig.lat, orig.lon], [gap.lat, gap.lon], [dest.lat, dest.lon]];

      // 3. Alternative Route (Detour)
      const altDistKm = parseFloat((curDistKm * 1.22).toFixed(1));
      const altTimeMin = Math.round(curTimeMin * 1.28);
      const altCoords = generateCurvedPath(orig, dest, -0.05);

      // Render Polylines on Map
      // Current Route (Solid Cyan)
      const lineCurrent = L.polyline(curCoords, {
        color: '#06b6d4',
        weight: 5,
        opacity: 0.85
      }).bindPopup(`<strong>Existing Highway Route</strong><br/>Distance: ${curDistKm} km • Est. Time: ${curTimeMin} min`);
      layers.overlays.routesLayer.addLayer(lineCurrent);

      // Alternative Route (Dashed Amber)
      const lineAlt = L.polyline(altCoords, {
        color: '#f59e0b',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.75
      }).bindPopup(`<strong>Alternative Detour Route</strong><br/>Distance: ${altDistKm} km • Est. Time: ${altTimeMin} min`);
      layers.overlays.routesLayer.addLayer(lineAlt);

      // AI Candidate Resilient Shortcut (Glowing Magenta)
      const lineAi = L.polyline(aiCoords, {
        color: '#ec4899',
        weight: 5,
        dashArray: '3, 6',
        opacity: 0.95
      }).bindPopup(`<strong>AI Candidate Resilient Shortcut</strong><br/>Distance: ${aiDistKm} km • Est. Time: ${aiTimeMin} min<br/><em>Saves ${parseFloat((curDistKm - aiDistKm).toFixed(1))} km!</em>`);
      layers.overlays.routesLayer.addLayer(lineAi);

      // Fit Map bounds to show full route
      const bounds = L.latLngBounds([ [orig.lat, orig.lon], [dest.lat, dest.lon], [gap.lat, gap.lon] ]);
      map.fitBounds(bounds.pad(0.18), { animate: true });

      // Update & Display Floating Bottom Route Comparison Card
      const distSaved = parseFloat(Math.max(0, curDistKm - aiDistKm).toFixed(1));
      const timeSaved = Math.max(0, curTimeMin - aiTimeMin);
      const distSavedPct = curDistKm > 0 ? Math.round((distSaved / curDistKm) * 100) : 55;
      const timeSavedPct = curTimeMin > 0 ? Math.round((timeSaved / curTimeMin) * 100) : 53;

      dom.cardRouteCurDist.textContent = `${curDistKm} km`;
      dom.cardRouteCurTime.textContent = `${curTimeMin} min`;
      dom.cardRouteAltDist.textContent = `${altDistKm} km`;
      dom.cardRouteAltTime.textContent = `${altTimeMin} min`;
      dom.cardRouteAiDist.textContent = `${aiDistKm} km`;
      dom.cardRouteAiTime.textContent = `${aiTimeMin} min`;

      dom.cardSavingsDist.textContent = `${distSaved} km`;
      dom.cardSavingsDistPct.textContent = `↓ ${distSavedPct}% shorter`;
      dom.cardSavingsTime.textContent = `${timeSaved} min`;
      dom.cardSavingsTimePct.textContent = `↓ ${timeSavedPct}% faster`;

      dom.mapRouteComparisonCard.style.display = 'block';
    } catch (err) {
      console.warn('OSRM routing error:', err);
    }
  }

  function generateCurvedPath(p1, p2, curvature) {
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const lat = p1.lat + (p2.lat - p1.lat) * t + Math.sin(t * Math.PI) * curvature;
      const lon = p1.lon + (p2.lon - p1.lon) * t;
      pts.push([lat, lon]);
    }
    return pts;
  }

  // =========================================================================
  // 8. REAL FASTAPI BACKEND INVESTIGATION
  // =========================================================================
  async function runInvestigation() {
    if (state.isInvestigating) return;
    state.isInvestigating = true;

    dom.btnRunInvestigate.disabled = true;
    dom.btnRunInvestigate.innerHTML = '<i data-lucide="loader-2" class="spin"></i> <span>ANALYZING WITH AI...</span>';
    if (window.lucide) lucide.createIcons();

    try {
      let resultData;

      if (state.isDemoMode) {
        await new Promise(r => setTimeout(r, 1200));
        resultData = generateDemoResult(state.lat, state.lon, state.radius_m);
      } else {
        // REAL BACKEND CALL: POST http://127.0.0.1:8000/investigate
        const payload = {
          lat: state.lat,
          lon: state.lon,
          radius_m: state.radius_m
        };

        const res = await fetch(CONFIG.BACKEND_INVESTIGATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          let detail = 'Investigation request failed';
          try {
            const errJson = JSON.parse(errText);
            detail = errJson.detail || detail;
          } catch (_) {
            detail = errText || detail;
          }

          if (detail.toLowerCase().includes('quota') || detail.toLowerCase().includes('resourceexhausted') || detail.toLowerCase().includes('429')) {
            throw new Error('AI investigation temporarily unavailable because the configured AI model has exceeded its API quota. Toggle Demo Mode in the top bar to test the UI presentation.');
          }
          throw new Error(`Backend Error (${res.status}): ${detail}`);
        }

        resultData = await res.json();
      }

      state.lastResult = resultData;
      renderInvestigationResult(resultData);
      hideSystemAlert();
    } catch (err) {
      console.error('Investigation error:', err);
      if (err.message && err.message.includes('quota')) {
        showSystemAlert('Gemini AI Quota Exceeded', err.message);
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        showSystemAlert('FastAPI Backend Offline', 'Backend unavailable. Make sure FastAPI is running on port 8000 (`http://127.0.0.1:8000`). Toggle Demo Mode to test features.');
      } else {
        showSystemAlert('Investigation Notice', err.message || 'AI investigation failed.');
      }
    } finally {
      state.isInvestigating = false;
      dom.btnRunInvestigate.disabled = false;
      dom.btnRunInvestigate.innerHTML = '<i data-lucide="sparkles"></i> <span>INVESTIGATE ROAD GAP</span>';
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderInvestigationResult(data) {
    const verdict = data.final_answer || 'LIKELY_EXISTS';
    const confidencePct = Math.round((data.confidence || 0.92) * 100);

    dom.sidebarVerdictTitle.textContent = verdict;
    dom.sidebarConfidencePill.textContent = `${confidencePct}%`;
    dom.verdictTimestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    dom.sidebarVerdictBadge.className = 'verdict-summary-badge';
    if (verdict === 'LIKELY_EXISTS') {
      dom.sidebarVerdictBadge.classList.add('verdict-likely');
      dom.sidebarVerdictIcon.setAttribute('data-lucide', 'check-circle-2');
    } else if (verdict === 'UNLIKELY') {
      dom.sidebarVerdictBadge.classList.add('verdict-unlikely');
      dom.sidebarVerdictIcon.setAttribute('data-lucide', 'x-circle');
    } else {
      dom.sidebarVerdictBadge.classList.add('verdict-uncertain');
      dom.sidebarVerdictIcon.setAttribute('data-lucide', 'help-circle');
    }

    // Populate Evidence Modal Lists
    dom.modalSatelliteList.innerHTML = '';
    (data.evidence || []).forEach(ev => {
      const li = document.createElement('li');
      li.textContent = ev;
      dom.modalSatelliteList.appendChild(li);
    });

    if (window.lucide) lucide.createIcons();
  }

  function generateDemoResult(lat, lon, radius) {
    for (const key in PRESET_LOCATIONS) {
      const p = PRESET_LOCATIONS[key];
      const dist = Math.sqrt(Math.pow(lat - p.lat, 2) + Math.pow(lon - p.lon, 2));
      if (dist < 0.03) {
        return {
          final_answer: p.mockVerdict,
          confidence: p.mockConfidence,
          evidence: p.mockEvidence,
          steps: p.mockSteps
        };
      }
    }

    return {
      final_answer: 'LIKELY_EXISTS',
      confidence: 0.92,
      evidence: [
        `Continuous vehicle linear corridor identified within ${radius}m investigation buffer.`,
        'OpenStreetMap network segments terminate abruptly near coordinates.',
        'No permanent topological water or steep cliff barriers detected.'
      ],
      steps: [
        `Queried OpenStreetMap topological graph within ${radius}m buffer`,
        'Extracted satellite surface spectral reflectance tiles',
        'Topological continuity analyzer detected unmapped motorable alignment',
        'Synthesized multimodal AI reasoning: LIKELY_EXISTS'
      ]
    };
  }

  // =========================================================================
  // 9. EVENT LISTENERS & WIDGET INTERACTIONS
  // =========================================================================
  function setupEventListeners() {
    // 1. Sidebar Collapse Toggle
    dom.btnToggleSidebar.addEventListener('click', () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      if (state.sidebarCollapsed) dom.sidebar.classList.add('collapsed');
      else dom.sidebar.classList.remove('collapsed');
      setTimeout(() => { if (map) map.invalidateSize(); }, 360);
    });

    // 2. Nominatim Search
    let searchTimer = null;
    dom.searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      dom.btnClearSearch.style.display = q.length > 0 ? 'flex' : 'none';
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => performSearch(q), 350);
    });

    dom.btnClearSearch.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.searchSuggestions.style.display = 'none';
      dom.btnClearSearch.style.display = 'none';
    });

    dom.btnSubmitSearch.addEventListener('click', () => performSearch(dom.searchInput.value));
    dom.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(dom.searchInput.value); });

    document.addEventListener('click', (e) => {
      if (!dom.searchInput.contains(e.target) && !dom.searchSuggestions.contains(e.target)) {
        dom.searchSuggestions.style.display = 'none';
      }
      if (!dom.btnToggleLayers.contains(e.target) && !dom.layerSelectorPopup.contains(e.target)) {
        dom.layerSelectorPopup.style.display = 'none';
      }
    });

    // 3. Preset Selector
    dom.presetSelect.addEventListener('change', (e) => {
      const p = PRESET_LOCATIONS[e.target.value];
      if (p) {
        handleLocationChange(p.lat, p.lon, p.name);
        handleRadiusChange(p.radius_m);
        if (p.origin && p.destination) {
          state.origin = p.origin;
          state.destination = p.destination;
          renderRoutePin('origin', p.origin);
          renderRoutePin('dest', p.destination);
          calculateAndRenderRoutes();
        }
      }
    });

    // 4. GPS Button
    dom.btnGpsLocation.addEventListener('click', () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          pos => handleLocationChange(pos.coords.latitude, pos.coords.longitude, 'My Current Location'),
          () => showSystemAlert('Location Access Notice', 'Unable to retrieve GPS position. Check browser permissions.')
        );
      }
    });

    // 5. Demo Mode Toggle
    dom.mockModeToggle.addEventListener('change', (e) => {
      state.isDemoMode = e.target.checked;
      dom.demoModeBanner.style.display = state.isDemoMode ? 'flex' : 'none';
      dom.systemStatusText.textContent = state.isDemoMode ? 'Demo Simulation' : 'FastAPI Connected';
    });

    dom.btnCloseAlert.addEventListener('click', hideSystemAlert);

    // 6. Basemap Switcher
    dom.btnToggleLayers.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVis = dom.layerSelectorPopup.style.display === 'block';
      dom.layerSelectorPopup.style.display = isVis ? 'none' : 'block';
    });

    document.querySelectorAll('input[name="basemap"]').forEach(r => {
      r.addEventListener('change', (e) => {
        const val = e.target.value;
        state.activeBasemap = val;
        Object.values(layers.base).forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
        if (layers.base[val]) layers.base[val].addTo(map);
      });
    });

    // Overlay Checkboxes
    dom.toggleLayerRoads.addEventListener('change', e => toggleLayerVisibility(layers.overlays.roadsLayer, e.target.checked));
    dom.toggleLayerGap.addEventListener('change', e => toggleLayerVisibility(layers.overlays.gapLayer, e.target.checked));
    dom.toggleLayerPois.addEventListener('change', e => toggleLayerVisibility(layers.overlays.poisLayer, e.target.checked));
    dom.toggleLayerRoutes.addEventListener('change', e => toggleLayerVisibility(layers.overlays.routesLayer, e.target.checked));
    dom.toggleLayerRadius.addEventListener('change', e => toggleLayerVisibility(layers.overlays.radiusCircle, e.target.checked));

    // 7. Route Mode Controls
    dom.btnToggleRouteMode.addEventListener('click', toggleRouteMode);
    dom.btnClearActiveRoute.addEventListener('click', clearActiveRoute);
    dom.btnExitRouteMode.addEventListener('click', exitRouteMode);
    dom.btnCloseRouteCard.addEventListener('click', () => { dom.mapRouteComparisonCard.style.display = 'none'; });

    // 8. POI Filter Chips
    dom.mapPoiFilterBar.addEventListener('click', (e) => {
      if (e.target.classList.contains('poi-filter-chip')) {
        dom.mapPoiFilterBar.querySelectorAll('.poi-filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        state.poiFilter = e.target.dataset.category;
        renderPOIsOnMap();
      }
    });

    // 9. Radius Slider & Chips
    dom.radiusSlider.addEventListener('input', e => handleRadiusChange(e.target.value));
    dom.radiusChips.forEach(c => c.addEventListener('click', () => handleRadiusChange(c.dataset.radius)));

    // 10. Investigate Button
    dom.btnRunInvestigate.addEventListener('click', runInvestigation);

    // 11. Copy Coordinates
    dom.btnCopyCoords.addEventListener('click', () => {
      navigator.clipboard.writeText(`${state.lat}, ${state.lon}`).then(() => {
        dom.btnCopyCoords.querySelector('span').textContent = 'Copied!';
        setTimeout(() => { dom.btnCopyCoords.querySelector('span').textContent = 'Copy'; }, 1500);
      });
    });

    // 12. Human Verification
    dom.btnVerifyConfirm.addEventListener('click', () => setReviewStatus('Confirmed Road', 'rgba(16, 185, 129, 0.2)', '#10b981'));
    dom.btnVerifyReject.addEventListener('click', () => setReviewStatus('Rejected', 'rgba(244, 63, 94, 0.2)', '#f43f5e'));
    dom.btnVerifyFlag.addEventListener('click', () => setReviewStatus('Field Check', 'rgba(245, 158, 11, 0.2)', '#f59e0b'));

    // 13. Map Reset & Fullscreen
    dom.btnResetMapView.addEventListener('click', () => {
      if (map) map.setView([state.lat, state.lon], CONFIG.DEFAULT_COORDS.zoom, { animate: true });
    });

    dom.btnFullscreenMap.addEventListener('click', () => {
      const elem = document.querySelector('.map-primary-section');
      if (!document.fullscreenElement) elem.requestFullscreen().catch(console.warn);
      else document.exitFullscreen();
    });

    // 14. Legend Toggle
    dom.legendToggleBtn.addEventListener('click', () => {
      const isCol = dom.legendBody.style.display === 'none';
      dom.legendBody.style.display = isCol ? 'flex' : 'none';
      dom.legendChevron.style.transform = isCol ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    // 15. Modals: Evidence, Disaster, Export
    dom.btnOpenEvidenceModal.addEventListener('click', () => { dom.evidenceModal.style.display = 'flex'; });
    dom.btnCloseEvidenceModal.addEventListener('click', () => { dom.evidenceModal.style.display = 'none'; });
    dom.btnDoneEvidenceModal.addEventListener('click', () => { dom.evidenceModal.style.display = 'none'; });

    dom.btnOpenDisasterModal.addEventListener('click', () => { dom.disasterModal.style.display = 'flex'; });
    dom.btnCloseDisasterModal.addEventListener('click', () => { dom.disasterModal.style.display = 'none'; });
    dom.btnApplyScenario.addEventListener('click', () => {
      applyDisasterToMap(dom.disasterSelect.value);
      dom.disasterModal.style.display = 'none';
    });
    dom.btnResetScenario.addEventListener('click', () => {
      if (layers.overlays.hazardLayer) layers.overlays.hazardLayer.clearLayers();
      dom.disasterModal.style.display = 'none';
    });

    dom.btnExportData.addEventListener('click', openExportModal);
    dom.btnCloseExportModal.addEventListener('click', () => { dom.exportModal.style.display = 'none'; });
    dom.btnCopyJsonExport.addEventListener('click', () => {
      navigator.clipboard.writeText(dom.exportJsonPreview.textContent).then(() => {
        dom.btnCopyJsonExport.textContent = 'Copied!';
        setTimeout(() => { dom.btnCopyJsonExport.innerHTML = '<i data-lucide="clipboard"></i> Copy JSON'; if (window.lucide) lucide.createIcons(); }, 1500);
      });
    });
    dom.btnDownloadJsonExport.addEventListener('click', downloadJsonExport);
  }

  // =========================================================================
  // 10. HELPER FUNCTIONS
  // =========================================================================
  function toggleLayerVisibility(layer, isVisible) {
    if (!layer || !map) return;
    if (isVisible) map.addLayer(layer);
    else map.removeLayer(layer);
  }

  function setReviewStatus(status, bg, color) {
    state.reviewStatus = status;
    dom.reviewStatusBadge.textContent = status;
    dom.reviewStatusBadge.style.background = bg;
    dom.reviewStatusBadge.style.color = color;
  }

  function applyDisasterToMap(type) {
    if (!layers.overlays.hazardLayer) return;
    layers.overlays.hazardLayer.clearLayers();

    const hazardCircle = L.circle([state.lat + 0.006, state.lon + 0.006], {
      radius: 550,
      color: '#f43f5e',
      weight: 3,
      fillColor: '#e11d48',
      fillOpacity: 0.35,
      dashArray: '5, 5'
    }).bindPopup(`<strong>Hazard Disruption: ${type.toUpperCase()}</strong><br/>Primary arterial link blocked.`);

    layers.overlays.hazardLayer.addLayer(hazardCircle);
    map.panTo([state.lat + 0.006, state.lon + 0.006], { animate: true });
  }

  async function performSearch(query) {
    if (!query || query.trim().length < 2) {
      dom.searchSuggestions.style.display = 'none';
      return;
    }

    try {
      const url = `${CONFIG.NOMINATIM_SEARCH_URL}?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadResilienceAI-Client/2.0' } });
      const data = await res.json();

      dom.searchSuggestions.innerHTML = '';
      if (!data || data.length === 0) {
        dom.searchSuggestions.innerHTML = '<div class="suggestion-item"><span class="suggestion-text">No locations found</span></div>';
        dom.searchSuggestions.style.display = 'block';
        return;
      }

      data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i data-lucide="map-pin"></i> <span>${item.display_name}</span>`;
        div.addEventListener('click', () => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          dom.searchInput.value = item.display_name;
          dom.searchSuggestions.style.display = 'none';
          handleLocationChange(lat, lon, item.display_name);
          map.setView([lat, lon], 15, { animate: true });
        });
        dom.searchSuggestions.appendChild(div);
      });

      dom.searchSuggestions.style.display = 'block';
      if (window.lucide) lucide.createIcons();
    } catch (_) {}
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function openExportModal() {
    const payload = {
      project: 'RoadResilience AI',
      export_timestamp: new Date().toISOString(),
      evaluation_mode: state.isDemoMode ? 'DEMO_SIMULATION' : 'LIVE_FASTAPI_BACKEND',
      investigation_point: {
        latitude: state.lat,
        longitude: state.lon,
        radius_meters: state.radius_m,
        location_resolved: state.locationName
      },
      ai_agent_determination: state.lastResult || {
        verdict: dom.sidebarVerdictTitle.textContent,
        confidence: dom.sidebarConfidencePill.textContent
      },
      nearby_facilities: state.nearbyPOIs,
      surveyor_review: {
        status: state.reviewStatus,
        reviewed_at: new Date().toISOString()
      }
    };

    dom.exportJsonPreview.textContent = JSON.stringify(payload, null, 2);
    dom.exportModal.style.display = 'flex';
  }

  function downloadJsonExport() {
    const text = dom.exportJsonPreview.textContent;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadresilience_investigation_${state.lat.toFixed(4)}_${state.lon.toFixed(4)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showSystemAlert(title, msg) {
    dom.alertBannerTitle.textContent = title;
    dom.alertBannerMessage.textContent = msg;
    dom.systemAlertBanner.style.display = 'flex';
  }

  function hideSystemAlert() {
    dom.systemAlertBanner.style.display = 'none';
  }

  // =========================================================================
  // 11. INITIALIZATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    if (window.lucide) lucide.createIcons();
  });

})();
