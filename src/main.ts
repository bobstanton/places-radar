import { App, Plugin } from "obsidian";
import { IPlaceExtensionSettings, IPlacesExtensionHostSettings } from "places-shared/settings";
import { IPlacePluginExtension, IPlacePluginExtensionExports, registerPlaceExtensionLifecycle, settingsOnlyExports, PLACES_EXTENSION_API_VERSION, type ExtensionSettingsGroup } from "places-shared/services";
import { Utilities, configureRequestLogging } from "places-shared/utils";
import { apiKeySettingItem, countrySettingItem, styleDropdownItem } from "places-shared/ui";
import RadarApiService from "./RadarApiService";
import { RadarRouteOverlayService } from "./RadarRouteOverlayService";
import { RadarMapBlockProcessor, RADAR_STYLES } from "./RadarMapBlockProcessor";
import { buildImageAlignment } from "places-maplibre-base";
import { PROVIDER_ICON } from "./provider-icon";
import "@radarlabs/plugin-maps/dist/radar-maps.css";
import "places-maplibre-base/styles.css";

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
      return settingsOnlyExports(this.settingsGroup());
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
      settingsGroup: this.settingsGroup()
    };
  }

  private settingsGroup(): ExtensionSettingsGroup {
    return {
      heading: "Radar",
      items: [
        apiKeySettingItem("Radar", "API key for Radar"),
        countrySettingItem("Country to limit searches to (optional)"),
        styleDropdownItem({
          desc: "Default map style for Radar maps. Blocks can also use a custom Maps Studio style id via style:",
          styles: [
            { value: "radar-default-v1", name: "Radar Default" },
            { value: "radar-dark-v1", name: "Radar Dark" },
            { value: "radar-light-v1", name: "Radar Light" },
            { value: "radar-satellite-v1", name: "Satellite (Enterprise plan)" },
            { value: "radar-hybrid-v1", name: "Hybrid (Enterprise plan)" }
          ],
          fallbackStyle: "radar-default-v1"
        }),
      ],
    };
  }

}
