import { useEffect } from "react";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE_SUFFIX,
  ORG,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

type SeoProps = {
  title: string;
  description?: string;
  /** Path (e.g. "/sdk") used to build the canonical URL. Defaults to current path. */
  path?: string;
  keywords?: string[];
  /** Absolute or site-relative og:image URL. */
  image?: string;
  /** Set false to add robots noindex. */
  indexable?: boolean;
  /** JSON-LD object or array of objects. */
  jsonLd?: object | object[];
  type?: string;
};

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

const SEO_SCRIPT_ID = "cloudnest-jsonld";

/**
 * Runtime SEO head manager. Because CloudNest is a client-rendered SPA and
 * Googlebot executes JS, we set document title + meta at mount. Raw-text AI
 * crawlers are served separately by /llms.txt, /llms-full.txt, and /ai-prompt.md.
 */
export const Seo = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  keywords,
  image,
  indexable = true,
  jsonLd,
  type = "website",
}: SeoProps) => {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME)
      ? title
      : `${title} | ${DEFAULT_TITLE_SUFFIX.split(" | ")[1] ?? SITE_NAME}`;
    document.title = fullTitle;

    const canonical = `${SITE_URL}${path ?? window.location.pathname}`;
    const ogImage = image ? (image.startsWith("http") ? image : `${SITE_URL}${image}`) : `${SITE_URL}/vite.svg`;

    upsertMeta("name", "description", description);
    if (keywords?.length) upsertMeta("name", "keywords", keywords.join(", "));
    upsertMeta("name", "robots", indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow");
    upsertLink("canonical", canonical);

    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImage);

    // Org-wide + page JSON-LD.
    let script = document.getElementById(SEO_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = SEO_SCRIPT_ID;
      document.head.appendChild(script);
    }
    const orgLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: ORG.name,
      url: ORG.url,
      logo: ORG.logo,
      sameAs: [ORG.github],
    };
    const pages = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    script.textContent = JSON.stringify([orgLd, ...pages]);

    return () => {
      // Remove page-specific JSON-LD on unmount to avoid stale data.
      script?.remove();
    };
  }, [title, description, path, keywords?.join(","), image, indexable, jsonLd, type]);

  return null;
};

export default Seo;
