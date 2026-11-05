import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cn_cookie_consent";
const CONSENT_VERSION = 1;

export type CookieConsent = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export const defaultConsent: CookieConsent = {
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: new Date(0).toISOString(),
};

export const hasStoredConsent = (): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as CookieConsent;
    return parsed.version === CONSENT_VERSION;
  } catch {
    return false;
  }
};

export const readConsent = (): CookieConsent | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
};

export const writeConsent = (
  partial: Pick<CookieConsent, "analytics" | "marketing">,
): CookieConsent => {
  const next: CookieConsent = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: partial.analytics,
    marketing: partial.marketing,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable in private mode */
  }
  window.dispatchEvent(new CustomEvent<CookieConsent>("cn:cookie-consent", { detail: next }));
  return next;
};

export const clearConsent = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("cn:cookie-consent", { detail: null }));
};

/**
 * Gate for non-essential (third-party) scripts. No analytics/marketing tags
 * exist yet, but this exposes a stable check for when they are added.
 */
export const consentAllows = (category: "analytics" | "marketing"): boolean => {
  const c = readConsent();
  return !!c && c[category] === true;
};

export const useCookieConsent = () => {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent());
  const [decided, setDecided] = useState<boolean>(() => hasStoredConsent());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CookieConsent | null>).detail;
      setConsent(detail);
      setDecided(detail !== null);
    };
    window.addEventListener("cn:cookie-consent", handler);
    return () => window.removeEventListener("cn:cookie-consent", handler);
  }, []);

  const acceptAll = useCallback(() => {
    setConsent(writeConsent({ analytics: true, marketing: true }));
    setDecided(true);
  }, []);
  const rejectNonEssential = useCallback(() => {
    setConsent(writeConsent({ analytics: false, marketing: false }));
    setDecided(true);
  }, []);
  const save = useCallback((analytics: boolean, marketing: boolean) => {
    setConsent(writeConsent({ analytics, marketing }));
    setDecided(true);
  }, []);

  return { consent, decided, acceptAll, rejectNonEssential, save };
};
