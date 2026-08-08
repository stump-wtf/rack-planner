import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// ============================================================
// rack-planner docs — deployed to BOTH Gitea Pages and GitHub Pages.
// Both serve under the /rack-planner/ subpath, so BASE_URL is shared; only the
// host (url) differs, set per-CI via the SITE_URL env var.
//
// Read env with `||`, never `??`: CI can hand these through as an EMPTY STRING,
// which `??` happily accepts and which then bakes a broken origin into every
// canonical link and the sitemap.
// ============================================================
const PROJECT_TITLE = "rack planner";
const PROJECT_TAGLINE = 'snap-to-grid planning for 10" mini racks.';
const GITEA_URL = "https://gitea.stump.rocks/stump.wtf/rack-planner";
const GITHUB_URL = "https://github.com/stump-wtf/rack-planner";
const APP_URL = "https://rack-planner.stump.rocks";
const SITE_URL = process.env.SITE_URL || "https://stump-wtf.pages.stump.rocks";
const BASE_URL = "/rack-planner/";

// One "source" link that matches the host THIS build is served from, resolved at
// build time so no runtime host sniffing is needed.
const IS_GITHUB = SITE_URL.includes("github");
const SOURCE_URL = IS_GITHUB ? GITHUB_URL : GITEA_URL;
const SOURCE_LABEL = IS_GITHUB ? "GitHub" : "Gitea";
// ============================================================

const config: Config = {
  title: PROJECT_TITLE,
  tagline: PROJECT_TAGLINE,
  favicon: "img/favicon.svg",

  // NB: no `future: { v4: true }`. On 3.10 that switches the bundler to rspack
  // via @docusaurus/faster, which is not a dependency here — the build dies with
  // ERR_MODULE_NOT_FOUND deep inside getCurrentBundler(). Webpack is pinned
  // deliberately (see overrides in package.json); leave the bundler alone.

  url: SITE_URL,
  baseUrl: BASE_URL,

  customFields: {
    sourceUrl: SOURCE_URL,
    sourceLabel: SOURCE_LABEL,
    appUrl: APP_URL,
  },

  onBrokenLinks: "throw",

  // No mermaid. @docusaurus/theme-mermaid still throws the SSR
  // "useColorMode called outside <ColorModeProvider>" ReactContextError on
  // 3.10.1 with React 19. The one diagram here is drawn with box characters,
  // which matches the house style and costs the docs build nothing.
  markdown: {
    format: "detect",
    hooks: { onBrokenMarkdownLinks: "warn" },
  },
  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      { hashed: true, indexBlog: false, docsRouteBasePath: "/" },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: `${GITEA_URL}/_edit/main/docs-site/`,
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
    navbar: {
      title: PROJECT_TITLE,
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "docs" },
        { href: APP_URL, label: "open the planner ↗", position: "right" },
        { href: SOURCE_URL, label: SOURCE_LABEL, position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "docs",
          items: [
            { label: "getting started", to: "/" },
            { label: "the grid model", to: "/grid-model" },
            { label: "self-hosting", to: "/self-hosting" },
          ],
        },
        {
          title: "more",
          items: [
            { label: "open the planner", href: APP_URL },
            { label: SOURCE_LABEL, href: SOURCE_URL },
          ],
        },
      ],
      copyright: `MIT. built for 10" racks that are too small to guess about.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "yaml", "docker"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
