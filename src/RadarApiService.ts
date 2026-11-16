import Radar, { type RadarGeocodeLayer } from 'radar-sdk-js';
import { Place } from "places-shared/place";
import { Coordinate, PlacesBoundingBox } from "places-shared/geo";
import { IPlaceExtensionSettings } from "places-shared/settings";
import { IPlacesService, lookupPlaceWithNearOrInQuery } from "places-shared/services";
import { logger } from "places-shared/utils";

export default class RadarService implements IPlacesService {
  extensionSettings: IPlaceExtensionSettings;

  constructor(extensionSettings: IPlaceExtensionSettings) {
    this.extensionSettings = extensionSettings;

    Radar.initialize(this.extensionSettings.apiKey, {
      cacheLocationMinutes: 10
    });
  }

  public async lookupPlace(query: string): Promise<Place[]> {
    return lookupPlaceWithNearOrInQuery(query, {
      search: (searchQuery, proximity) => this.executeSearch(searchQuery, proximity),
      geocodeLocation: async (location) => {
        const locationResults = await this.executeSearch(location);

        if (locationResults.length === 0) return null;
        const { longitude, latitude } = locationResults[0];

        return { proximity: { latitude, longitude } };
      },
      combineFallbackQuery: (poi: string, location: string) => `${poi} ${location}`,
      supportsStrictIn: false
    });
  }

  // Radar's autocomplete API has no bounding box filtering; this returns an empty array rather than out-of-bounds results.
  public lookupPlaceInBounds(_query: string, _bounds: PlacesBoundingBox): Promise<Place[]> {
    logger.scope('Places').debug('[Radar] lookupPlaceInBounds: API does not support bbox, returning empty results');

    return Promise.resolve([]);
  }

  private async executeSearch(searchQuery: string, near?: { latitude: number; longitude: number }): Promise<Place[]> {
    const options = {
      query: searchQuery,
      countryCode: this.extensionSettings.country ?? "us",
      layers: ["fine"] as RadarGeocodeLayer[],
      limit: 15,
      ...(near ? { near } : {})
    };

    const response = await Radar.autocomplete(options);

    return response.addresses.map(address => this.mapAddress(address));
  }

  public async lookupPlaceByCoordinates(coordinate: Coordinate): Promise<Place[]> {
    const response = await Radar.reverseGeocode({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      layers: ["fine"] as RadarGeocodeLayer[]
    });

    return response.addresses.map(address => this.mapAddress(address));
  }

  private mapAddress(address: Awaited<ReturnType<typeof Radar.autocomplete>>['addresses'][number]): Place {
    return {
      name: address.placeLabel ?? "",
      latitude: address.latitude,
      longitude: address.longitude,
      address: (address.formattedAddress ?? "").replace(" # Not", ""),
      city: address.city ?? "",
      state: address.state ?? "",
      postalCode: address.postalCode ?? "",
      country: address.country ?? "",
      website: "",
      tags: [],
      source: "radar",
      attribution: "© Radar © OpenStreetMap"
    };
  }
}
