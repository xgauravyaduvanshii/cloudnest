export const isAuthRoute = (pathname: string): boolean => {
  return Object.values(AUTH_ROUTES).includes(pathname);
};

export const AUTH_ROUTES = {
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
};

export const PUBLIC_ROUTES = {
  HOME: "/",
  SDK: "/sdk",
  AI_PROMPT: "/ai-prompt",
  PRIVACY: "/privacy-policy",
  TERMS: "/terms-and-conditions",
  HELP: "/help",
  CONTACT: "/contact",
  SECURITY: "/security",
  ABOUT: "/about",
  SHARE: "/share/:token",
  DOCS: "/docs",
};

export const PROTECTED_ROUTES = {
  OVERVIEW: "/overview",
  APIKEYS: "/api-keys",
  WEBHOOKS: "/webhooks",
  FILES: "/files",
  COLLECTIONS: "/collections",
  ACTIVITY: "/activity",
  STORAGE_ACCOUNTS: "/storage-accounts",
  ADMIN: "/admin",
  SETTINGS: "/settings",
};
