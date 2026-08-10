# Places - Radar

Map provider for [Places](https://community.obsidian.md/plugins/places) using [Radar](https://radar.com/), with vector maps, POI search, and directions.

## Network requests

| Area                 | Request                                                      |
| -------------------- | ------------------------------------------------------------ |
| Map tiles and styles | Loads the selected map style, its glyphs, sprites, and tiles |
| POI search           | Resolves a search term to place suggestions and coordinates  |
| Reverse geocoding    | Resolves a coordinate to a place name                        |
| Directions           | Builds a route between two waypoints, one request per leg    |

## Background tasks

None.

## Dependencies

| Library                                                                    | Purpose                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| [radar-sdk-js](https://github.com/radarlabs/radar-sdk-js)                  | Search, reverse geocoding, and routing         |
| [@radarlabs/plugin-maps](https://github.com/radarlabs/radar-sdk-js)        | Supplies the Radar GL map                      |
| [maplibre-gl](https://github.com/maplibre/maplibre-gl-js)                  | GL map engine                                  |
| [places-shared](https://github.com/bobstanton/places-shared)               | Shared map, overlay, routing, and utility code |
| [places-maplibre-base](https://github.com/bobstanton/places-maplibre-base) | Shared GL map implementation                   |
