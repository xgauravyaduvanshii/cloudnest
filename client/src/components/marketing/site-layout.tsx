import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/routes/common/routePath";
import { FOOTER_LINKS, NAV_LINKS, ORG } from "@/lib/site";

export const Brand = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`flex items-center gap-3 ${className}`}>
    <span className="flex size-9 items-center justify-center rounded-[8px] border border-red-400/30 bg-red-500/15 text-red-100">
      <Cloud className="size-5" />
    </span>
    <span className="text-2xl font-bold leading-none">
      cloud<span className="text-red-500">nest</span>
    </span>
  </Link>
);

const isExternal = (href: string) => href.startsWith("http");

const NavItem = ({ label, href }: { label: string; href: string }) =>
  isExternal(href) ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="transition hover:text-white"
    >
      {label}
    </a>
  ) : (
    <Link to={href} className="transition hover:text-white">
      {label}
    </Link>
  );

export const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-20 border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm text-white/68 lg:flex">
          {NAV_LINKS.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="hidden rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Link to={AUTH_ROUTES.SIGN_IN}>Sign in</Link>
          </Button>
          <Button
            asChild
            className="rounded-[8px] bg-red-500 text-white hover:bg-red-400"
          >
            <Link to={AUTH_ROUTES.SIGN_UP}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 bg-black/40 px-5 py-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-white/75">
            {NAV_LINKS.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export const openCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent("cn:open-cookie-preferences"));
};

export const SiteFooter = () => (
  <footer className="border-t border-white/10 bg-[#070202] px-5 py-10 sm:px-8">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div className="max-w-sm space-y-3">
        <Brand />
        <p className="text-sm leading-6 text-white/55">
          One gateway for every enabled storage provider — Google Drive,
          Telegram, and AWS S3 — with encrypted credentials and admin controls.
        </p>
        <a
          href={ORG.github}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-red-200 underline-offset-4 hover:underline"
        >
          View on GitHub
        </a>
      </div>
      <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
        {FOOTER_LINKS.map((link) => (
          <Link key={link.href} to={link.href} className="transition hover:text-white">
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={openCookiePreferences}
          className="text-left transition hover:text-white"
        >
          Cookie settings
        </button>
      </nav>
    </div>
    <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-6 text-xs text-white/40">
      © {new Date().getFullYear()} CloudNest. All rights reserved.
    </div>
  </footer>
);

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * Shared marketing/legal page frame: hero header, main content region, footer.
 * Reused across all public pages for uniform styling.
 */
export const SiteLayout = ({ eyebrow, title, description, children }: PageShellProps) => (
  <div className="min-h-screen bg-[#070202] text-white">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-red-500 focus:px-3 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,72,80,.22),transparent_28%),linear-gradient(135deg,#080202_0%,#190505_48%,#451015_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:88px_88px]" />
      <div className="relative">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <p className="text-sm font-medium text-red-200">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
            {description}
          </p>
        </div>
      </div>
    </section>

    <main id="main" className="bg-[linear-gradient(180deg,#0b0303,#180506_45%,#080303)] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>

    <SiteFooter />
  </div>
);

export const Section = ({
  id,
  title,
  lead,
  children,
  className = "",
}: {
  id?: string;
  title?: string;
  lead?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section id={id} className={`scroll-mt-24 ${className}`}>
    {title && (
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    )}
    {lead && <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">{lead}</p>}
    {title && <div className="mt-6">{children}</div>}
    {!title && children}
  </section>
);

export const FeatureCard = ({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-[10px] border border-white/10 bg-white/[0.035] p-5">
    {Icon && <Icon className="mb-4 size-5 text-red-200" />}
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="mt-2 text-sm leading-6 text-white/60">{body}</div>
  </div>
);

export const CodeBlock = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-[8px] border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/75">
    <code style={{ whiteSpace: "pre" }}>{children}</code>
  </pre>
);

export const CtaBand = ({
  title,
  body,
  primaryHref = AUTH_ROUTES.SIGN_UP,
  primaryLabel = "Get started free",
}: {
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
}) => (
  <section className="mt-16 overflow-hidden rounded-[12px] border border-red-500/25 bg-[radial-gradient(circle_at_20%_20%,rgba(255,72,80,.25),transparent_40%),linear-gradient(135deg,#1a0505,#3a0d11)] p-8 sm:p-12">
    <h2 className="max-w-2xl text-2xl font-semibold sm:text-3xl">{title}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">{body}</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild className="rounded-[8px] bg-red-500 text-white hover:bg-red-400">
        <Link to={primaryHref}>
          {primaryLabel}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
        <Link to="/contact">Talk to us</Link>
      </Button>
    </div>
  </section>
);
