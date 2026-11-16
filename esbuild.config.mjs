import { runPluginBuild, createMaplibreWorkerInlinePlugin } from "./esbuild.shared.mjs";

await runPluginBuild({
  metafile: true,
  plugins: [await createMaplibreWorkerInlinePlugin(), {
    name: "single-maplibre-runtime",
    setup(build) {
      build.onEnd(result => {
        const engines = new Set(Object.keys(result.metafile?.inputs ?? {})
          .filter(path => path.includes("/maplibre-gl/"))
          .map(path => path.slice(0, path.lastIndexOf("/maplibre-gl/") + "/maplibre-gl/".length)));

        if (engines.size > 1) {
          return { errors: [{ text: `Radar bundled multiple MapLibre copies; cache protocols require one engine: ${[...engines].join(", ")}` }] };
        }
      });
    },
  }],
});
