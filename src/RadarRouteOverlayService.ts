import type * as GeoJSON from "geojson";
import Radar from "radar-sdk-js";
import { type IPlaceExtensionSettings } from "places-shared/settings";
import { type DirectionsOverlayRequest, type IsochroneOverlayRequest, type RouteOverlayCapabilities, type RouteOverlayService, addRouteEndpointFeatures, addRouteMetricLabelFeatures, assertProviderApiKey, buildRouteLegMetrics, buildRouteLegProperties, buildRouteWaypointProperties, describeProviderThrownError, formatRouteDistance, formatRouteDuration, formatRouteWaypointName, mapTravelMode } from "places-shared/services";

type RadarMode = "car" | "foot" | "bike";

const RADAR_MODES: { walk: RadarMode; bike: RadarMode; drive: RadarMode } = { walk: "foot", bike: "bike", drive: "car" };

// Directions through the official radar-sdk-js. The SDK's distance call
// returns route geometry between an origin and one destination; multi-waypoint
// routes are built one leg at a time.
export class RadarRouteOverlayService implements RouteOverlayService {
  constructor(private extensionSettings: IPlaceExtensionSettings) {}

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
      throw new Error("Radar does not offer route optimization.");
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

      for (let leg = 0; leg < route.length - 1; leg++) {
        const from = route[leg];
        const to = route[leg + 1];

        let legRoute;
        try {
          const result = await Radar.distance({
            origin: `${from.latitude},${from.longitude}`,
            destination: `${to.latitude},${to.longitude}`,
            modes: [mode],
            units: "metric",
            geometry: "linestring",
          });
          legRoute = result.routes[mode];
        } catch (error) {
          throw new Error(await describeProviderThrownError({ provider: "Radar", operation: "directions", requestSummary: `leg ${leg + 1}, ${request.mode}`, error }));
        }

        if (!legRoute?.geometry?.coordinates) {
          throw new Error(`Radar returned no ${request.mode} route between ${formatRouteWaypointName(from)} and ${formatRouteWaypointName(to)}`);
        }

        coordinates.push(...legRoute.geometry.coordinates);
        const legDistanceMeters = legRoute.distance?.value ?? 0;
        const legDurationSeconds = (legRoute.duration?.value ?? 0) * 60;
        distanceMeters += legDistanceMeters;
        durationSeconds += legDurationSeconds;
        legMetrics.push({ distanceMeters: legDistanceMeters, durationSeconds: legDurationSeconds });
      }

      if (coordinates.length === 0) continue;

      const routeFeature: GeoJSON.Feature = {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {
          name: request.name ? `${request.name} ${index + 1}` : `Route ${index + 1}`,
          provider: "radar",
          mode: request.mode,
          optimized: false,
          route_index: index,
          ...buildRouteWaypointProperties(route),
          ...buildRouteLegProperties(buildRouteLegMetrics(route, legMetrics)),
          distance_meters: distanceMeters,
          distance_text: formatRouteDistance(distanceMeters),
          duration_seconds: durationSeconds,
          duration_text: formatRouteDuration(durationSeconds),
          stroke: request.style?.color ?? "#2563eb",
          "stroke-width": request.style?.strokeWidth ?? 5,
          "stroke-opacity": request.style?.strokeOpacity ?? 0.85,
        },
      };
      features.push(routeFeature);
      await addRouteEndpointFeatures(features, routeFeature, request.waypointLabelTemplate);
      await addRouteMetricLabelFeatures(features, routeFeature, request.metricLabels, request.labelTemplate, request.legLabelTemplate);
    }

    return { type: "FeatureCollection", features };
  }

  async getIsochroneOverlay(_request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection> {
    throw new Error("Radar does not offer an isochrone API");
  }

}
