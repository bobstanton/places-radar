import type * as GeoJSON from "geojson";
import { type IPlaceExtensionSettings } from "places-shared/settings";
import { type DirectionsOverlayRequest, type IsochroneOverlayRequest, type RouteOverlayCapabilities, type RouteOverlayService, type RouteHttpClient, loggedRouteHttpClient, formatProviderApiError, appendDirectionsRouteFeatures, buildDirectionsRouteFeature, assertProviderApiKey, buildRouteLegMetrics, describeProviderThrownError, formatRouteWaypointName, mapTravelMode } from "places-shared/services";

type RadarMode = "car" | "foot" | "bike";

const RADAR_MODES: { walk: RadarMode; bike: RadarMode; drive: RadarMode } = { walk: "foot", bike: "bike", drive: "car" };

interface RadarRoute {
  geometry?: GeoJSON.LineString;
  legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
}

export class RadarRouteOverlayService implements RouteOverlayService {
  constructor(private extensionSettings: IPlaceExtensionSettings, private http: RouteHttpClient = loggedRouteHttpClient) {}

  getProviderName(): string {
    return "radar";
  }

  getCapabilities(): RouteOverlayCapabilities {
    return {
      supportsIsochrones: false,
      routeOptimization: false,
      distanceIsochrones: false,
      polygonIsochrones: false,
    };
  }

  async getDirectionsOverlay(request: DirectionsOverlayRequest): Promise<GeoJSON.FeatureCollection> {
    assertProviderApiKey(this.extensionSettings.apiKey, "Radar");

    if (request.optimize) {
      throw new Error("The Places Radar integration does not support route optimization.");
    }

    const features: GeoJSON.Feature[] = [];
    const mode = mapTravelMode(request.mode, RADAR_MODES);

    for (let index = 0; index < request.routes.length; index++) {
      const route = request.routes[index];

      if (route.length < 2) continue;

      const coordinates: number[][] = [];
      let distanceMeters = 0;
      let durationSeconds = 0;
      const legMetrics: Array<{ distanceMeters: number; durationSeconds: number }> = [];

      for (let start = 0; start < route.length - 1; start += 24) {
        const stops = route.slice(start, start + 25);
        const params = new URLSearchParams({
          locations: stops.map(stop => `${stop.latitude},${stop.longitude}`).join('|'),
          mode, units: 'metric', geometry: 'linestring',
        });
        let batchRoute: RadarRoute | undefined;

        try {
          const response = await this.http({
            url: `https://api.radar.io/v1/route/directions?${String(params)}`,
            headers: { Authorization: this.extensionSettings.apiKey ?? '' },
          });

          if (response.status >= 400) {
            throw new Error(formatProviderApiError({
              provider: 'Radar', operation: 'directions', status: response.status,
              json: response.json, text: response.text,
            }));
          }

          batchRoute = (response.json as { routes?: RadarRoute[] } | undefined)?.routes?.[0];
        } catch (error) {
          throw new Error(await describeProviderThrownError({ provider: "Radar", operation: "directions", requestSummary: `${stops.length} stops, ${request.mode}`, error }));
        }

        const geometry = batchRoute?.geometry;
        const legs = batchRoute?.legs;

        if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2
          || !Array.isArray(legs) || legs.length !== stops.length - 1) {
          throw new Error(`Radar returned an incomplete ${request.mode} route between ${formatRouteWaypointName(stops[0])} and ${formatRouteWaypointName(stops[stops.length - 1])}`);
        }

        const last = coordinates[coordinates.length - 1];
        const first = geometry.coordinates[0];
        const overlap = last && last[0] === first[0] && last[1] === first[1] ? 1 : 0;

        for (const position of geometry.coordinates.slice(overlap)) coordinates.push(position);

        for (const leg of legs) {
          const distance = leg.distance?.value;
          const duration = leg.duration?.value;

          if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0
            || typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
            throw new Error('Radar returned invalid route leg metrics');
          }

          distanceMeters += distance;
          durationSeconds += duration * 60;
          legMetrics.push({ distanceMeters: distance, durationSeconds: duration * 60 });
        }
      }

      if (coordinates.length === 0) continue;

      const routeFeature = buildDirectionsRouteFeature({
        request, provider: 'radar', routeIndex: index, route, optimized: false,
        geometry: { type: 'LineString', coordinates }, distanceMeters, durationSeconds,
        legs: buildRouteLegMetrics(route, legMetrics, request.units),
      });

      await appendDirectionsRouteFeatures(features, routeFeature, request);
    }

    return { type: "FeatureCollection", features };
  }

  async getIsochroneOverlay(_request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection> {
    throw new Error("Radar does not offer an isochrone API");
  }
}
