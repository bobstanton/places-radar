import { App } from "obsidian";
import { type UnitsSystem } from "places-shared/units";
import { IPlaceExtensionSettings } from "places-shared/settings";
import { MapLibreProviderBase, setGlRuntime, type MapGlRuntime } from "places-maplibre-base";
import { TileCache } from "places-shared/map";
import * as maplibregl from "maplibre-gl";
import Radar from "radar-sdk-js";
import { createMapsPlugin } from "@radarlabs/plugin-maps";

// Radar style ids (docs.radar.com/maps/maps); the Radar SDK resolves them to
// authenticated style URLs. Satellite and hybrid require an Enterprise plan.
// getStyleUrl passes any id through, including Custom Maps Studio style ids.
export const RADAR_STYLES = [
  'radar-default-v1',
  'radar-light-v1',
  'radar-dark-v1',
  'radar-satellite-v1',
  'radar-hybrid-v1',
];

export class RadarMapBlockProcessor extends MapLibreProviderBase {
  private static sdkInitializedWithKey: string | null = null;

  constructor(app: App, extensionSettings: IPlaceExtensionSettings, units: UnitsSystem, developerMode = false) {
    super(app, extensionSettings, units, developerMode);
    // This provider pins maplibre-gl 5 for its vendor SDK while the base is typed
    // against 6, and each bundles its own copy. Same engine at runtime.
    setGlRuntime(maplibregl as unknown as MapGlRuntime);
  }

protected getStyleUrl(style: string): string | undefined {
    if (!this.extensionSettings.apiKey) return undefined;
    // Bare style id - Radar.ui.map turns it into an authenticated style URL.
    return style;
  }

  protected getSupportedStyles(): string[] {
    return RADAR_STYLES;
  }

  protected getProviderClassName(): string {
    return 'radar';
  }

  protected override getProviderIntegration(): string {
    return 'radar-sdk-js + @radarlabs/plugin-maps';
  }


  // Construct through the Radar SDK: style resolution and publishable-key auth
  // headers come from the SDK. It peer-depends on this bundle's maplibre-gl, and
  // the returned map shares this bundle's prototypes and protocol registry.
  protected override constructMap(options: ConstructorParameters<MapGlRuntime['Map']>[0]): InstanceType<MapGlRuntime['Map']> {
    this.ensureSdkInitialized();
    const map = Radar.ui.map({
      ...options,
      // Base and block settings drive controls; suppress the SDK's own additions.
      showZoomControls: false,
    } as unknown as Parameters<typeof Radar.ui.map>[0]) as unknown as InstanceType<MapGlRuntime['Map']>;

    if (this.supportsTileCache() && TileCache.isEnabled()) {
      // The SDK's transformRequest adds the Authorization header on every
      // request. Route requests through the tile cache protocol instead; the
      // cache fetcher re-adds the header via getCacheableResourceHeaders().
      this.ensureTileCacheProtocol();
      map.setTransformRequest((url) => {
        if (url.startsWith('https://')) {
          return { url: this.toCacheProtocolUrl(url) };
        }
        return { url };
      });
    }

    return map;
  }

  protected override getCacheableResourceHeaders(): Record<string, string> | undefined {
    if (!this.extensionSettings.apiKey) return undefined;
    return { Authorization: this.extensionSettings.apiKey };
  }

  private ensureSdkInitialized(): void {
    const key = this.extensionSettings.apiKey ?? '';
    if (RadarMapBlockProcessor.sdkInitializedWithKey === key) return;
    Radar.registerPlugin(createMapsPlugin());
    Radar.initialize(key);
    RadarMapBlockProcessor.sdkInitializedWithKey = key;
  }
}
