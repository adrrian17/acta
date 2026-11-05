import {
  defineConfig,
  minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: {
    ...preset,
    apple: { ...preset.apple, padding: 0 },
  },
  images: ["public/favicon.svg"],
});
