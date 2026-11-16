import { App, Plugin } from "obsidian";
import { IPlaceExtensionSettings, IPlacesExtensionHostSettings } from "places-shared/settings";
import { IPlacePluginExtension, IPlacePluginExtensionExports, registerPlaceExtensionLifecycle, settingsOnlyExports, PLACES_EXTENSION_API_VERSION, type ExtensionSettingsGroup } from "places-shared/obsidian/services";
import { Utilities, configureRequestLogging } from "places-shared/utils";
import { apiKeySettingItem, countrySettingItem, settingsPageStatus, styleDropdownItem } from "places-shared/obsidian/ui";
import RadarApiService from "./RadarApiService";
import { RadarRouteOverlayService } from "./RadarRouteOverlayService";
import { RadarMapBlockProcessor, RADAR_STYLES } from "./RadarMapBlockProcessor";
import { RADAR_STYLES as RADAR_STYLE_CATALOG } from "places-radar/core";
import { buildImageAlignment } from "places-shared/obsidian/maplibre";
import { PROVIDER_ICON } from "./provider-icon";
import "@radarlabs/plugin-maps/dist/radar-maps.css";
import "places-shared/maplibre-styles.css";

const DEFAULT_SETTINGS: IPlaceExtensionSettings = {
  defaultStyle: "radar-default-v1"
};

export default class RadarPlacePluginExtension extends Plugin implements IPlacePluginExtension {
  onload() {
    registerPlaceExtensionLifecycle(this);
  }
  
  getPlaceExports(app: App, extensionSettings: IPlaceExtensionSettings, mainSettings: IPlacesExtensionHostSettings): IPlacePluginExtensionExports {
    configureRequestLogging(mainSettings.developerMode);
    Utilities.applyDefaults(extensionSettings, DEFAULT_SETTINGS);

    if (!extensionSettings.apiKey) {
      return settingsOnlyExports(this.settingsGroup(extensionSettings));
    }

    const mapBlockProcessor = new RadarMapBlockProcessor(app, extensionSettings, mainSettings.units, mainSettings.developerMode);
    const placesService = new RadarApiService(extensionSettings);
    const routeOverlayService = new RadarRouteOverlayService(extensionSettings);
    
    const imageAlignment = buildImageAlignment(
      app,
      "Radar",
      (style) => `https://api.radar.io/maps/styles/${style || extensionSettings.defaultStyle}?publishableKey=${extensionSettings.apiKey}`
    );

    return {
      apiVersion: PLACES_EXTENSION_API_VERSION,
      providers: [
        {
          name: "radar",
          mapDefaults: { style: extensionSettings.defaultStyle },
          styles: RADAR_STYLES,
          features: {
            poiDiscovery: true,
            vector: true,
            tileCache: true
          },
          map: mapBlockProcessor,
          geocoding: {
            service: placesService,
            icon: PROVIDER_ICON
          },
          routeOverlay: routeOverlayService,
          imageAlignment
        }
      ],
      settingsGroup: this.settingsGroup(extensionSettings)
    };
  }

  private settingsGroup(settings: IPlaceExtensionSettings): ExtensionSettingsGroup {
    return {
      heading: "Radar",
      ...settingsPageStatus(() => Boolean(settings.apiKey?.trim())),
      reloadOn: ["apiKey", "defaultStyle"],
      items: [
        apiKeySettingItem("Radar", "API key for Radar"),
        countrySettingItem("Country to limit searches to (optional)"),
        styleDropdownItem({
          desc: "Default map style for Radar maps. Blocks can also use a custom Maps Studio style id via style:",
          styles: RADAR_STYLE_CATALOG.map(({ value, settingsName }) => ({ value, name: settingsName })),
          fallbackStyle: "radar-default-v1"
        }),
      ],
    };
  }
}
