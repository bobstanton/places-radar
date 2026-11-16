import { App } from "obsidian";
import { type UnitsSystem } from "places-shared/units";
import { IPlaceExtensionSettings } from "places-shared/settings";
import { MapLibreProviderBase, setGlRuntime, installMaplibreWorker, type MapGlRuntime } from "places-shared/obsidian/maplibre";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerCode from "maplibre-worker-bundle";
import Radar from "radar-sdk-js";
import { createMapsPlugin } from "@radarlabs/plugin-maps";

import { RADAR_STYLES as CORE_RADAR_STYLES } from './RadarStyles';
import { styleIds } from 'places-shared/map';

const RADAR_API_ORIGIN = 'https://api.radar.io';

export const RADAR_STYLES = styleIds(CORE_RADAR_STYLES);

export class RadarMapBlockProcessor extends MapLibreProviderBase {
  private static sdkInitializedWithKey: string | null = null;

  constructor(app: App, extensionSettings: IPlaceExtensionSettings, units: UnitsSystem, developerMode = false) {
    super(app, extensionSettings, units, developerMode);
    installMaplibreWorker(maplibregl, maplibreWorkerCode);
    setGlRuntime(maplibregl);
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

  protected override constructMap(options: ConstructorParameters<MapGlRuntime['Map']>[0]): InstanceType<MapGlRuntime['Map']> {
    this.ensureSdkInitialized();
    const map = Radar.ui.map({
      ...(options as unknown as Parameters<typeof Radar.ui.map>[0]),
      showZoomControls: false,
    }) as unknown as InstanceType<MapGlRuntime['Map']>;

    if (options.transformRequest) map.setTransformRequest(options.transformRequest);

    return map;
  }

  protected override getCacheableResourceHeaders(url: string): Record<string, string> | undefined {
    if (!this.extensionSettings.apiKey || new URL(url).origin !== RADAR_API_ORIGIN) return undefined;

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
