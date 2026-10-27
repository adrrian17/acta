// oxlint-disable typescript/no-non-null-assertion
import ultracite from "ultracite/oxfmt";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import drizzle from "ultracite/oxlint/drizzle";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import { defineConfig } from "vite-plus";

const jsPlugins = selectJsPlugins([
  "github",
  "sonarjs",
  "tsdoc",
  "react-doctor",
]);

const skills = [".agents/skills/**", ".claude/skills/**"];

// shadcn-generated; left untouched so `shadcn add` updates apply cleanly
const shadcnComponents = ["packages/ui/src/components/**"];

export default defineConfig({
  lint: {
    env: core.env,
    extends: [
      core,
      react,
      tanstack,
      drizzle,
      tanstackJsPlugins,
      shadcn,
      antiSlop,
      jsPlugins,
    ],
    ignorePatterns: [...core.ignorePatterns!, ...skills, ...shadcnComponents],
    jsPlugins: [...jsPlugins.jsPlugins, ...shadcn.jsPlugins],
    rules: {
      // shadcn generates function declarations; keep `shadcn add` output lint-clean
      "func-style": "off",
      "react/function-component-definition": "off",
    },
    options: {
      typeAware: true,
      typeCheck: false,
    },
    settings: jsPluginSettings,
  },
  fmt: {
    ...ultracite,
    ignorePatterns: [...ultracite.ignorePatterns!, ...skills],
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
