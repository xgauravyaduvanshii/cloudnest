// Central site constants used by SEO, marketing layout, and public pages.
// SITE_URL can be overridden at build time via VITE_SITE_URL.

const envSiteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(
  /\/$/,
  "",
);

export const SITE_URL = envSiteUrl || "https://cloudnest.urmate.tech";
export const SITE_NAME = "CloudNest";
export const ORG = {
  name: "CloudNest",
  url: SITE_URL,
  logo: `${SITE_URL}/vite.svg`,
  github: "https://github.com/xgauravyaduvanshii/cloudnest",
  email: "support@urmate.tech",
};
export const DEFAULT_TITLE_SUFFIX = "CloudNest | Multi-Provider Cloud Storage";
export const DEFAULT_DESCRIPTION =
  "CloudNest is a multi-provider storage control plane: manage uploads, API keys, folders, previews, and downloads across Google Drive, Telegram, and AWS S3 from one dashboard.";

export const LEGAL_EFFECTIVE_DATE = "2025-01-01";

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Platform", href: "/#platform" },
  { label: "Providers", href: "/#providers" },
  { label: "Docs", href: "/docs" },
  { label: "SDK", href: "/sdk" },
  { label: "AI Prompt", href: "/ai-prompt" },
  { label: "Help", href: "/help" },
];

export const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "Docs", href: "/docs" },
  { label: "SDK", href: "/sdk" },
  { label: "AI Prompt", href: "/ai-prompt" },
  { label: "Help", href: "/help" },
  { label: "Contact", href: "/contact" },
  { label: "About", href: "/about" },
  { label: "Security", href: "/security" },
  { label: "Privacy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms-and-conditions" },
];
