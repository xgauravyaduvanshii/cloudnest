import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  Cloud,
  Database,
  Eye,
  Github,
  HardDrive,
  KeyRound,
  Layers3,
  LockKeyhole,
  Server,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTypedSelector } from "@/app/hook";
import {
  AUTH_ROUTES,
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
} from "@/routes/common/routePath";

const navItems = [
  { label: "Platform", href: "#platform" },
  { label: "Providers", href: "#providers" },
  { label: "SDK", href: PUBLIC_ROUTES.SDK },
  { label: "Help", href: PUBLIC_ROUTES.HELP },
  { label: "GitHub", href: "https://github.com/xgauravyaduvanshii/cloudnest" },
];

const footerLinks = [
  { label: "SDK", href: PUBLIC_ROUTES.SDK },
  { label: "Help", href: PUBLIC_ROUTES.HELP },
  { label: "Contact", href: PUBLIC_ROUTES.CONTACT },
  { label: "Privacy", href: PUBLIC_ROUTES.PRIVACY },
  { label: "Terms", href: PUBLIC_ROUTES.TERMS },
  { label: "Security", href: PUBLIC_ROUTES.SECURITY },
  { label: "About", href: PUBLIC_ROUTES.ABOUT },
];

const providers = [
  { name: "Google Drive", icon: Cloud, tone: "text-red-200" },
  { name: "Telegram", icon: Bot, tone: "text-sky-200" },
  { name: "AWS S3", icon: HardDrive, tone: "text-amber-200" },
  { name: "Postgres", icon: Database, tone: "text-emerald-200" },
];

const features = [
  {
    title: "Provider control",
    body: "Admins can enable or pause Google Drive, Telegram, and AWS S3 from one place.",
    icon: ShieldCheck,
  },
  {
    title: "Smart routing",
    body: "Uploads can use active personal accounts or shared admin storage automatically.",
    icon: UploadCloud,
  },
  {
    title: "Secure keys",
    body: "OAuth tokens, Telegram sessions, and provider secrets stay encrypted and write-only.",
    icon: LockKeyhole,
  },
];

const flowSteps = [
  { label: "Upload", icon: UploadCloud },
  { label: "Route", icon: Layers3 },
  { label: "Store", icon: Server },
  { label: "Preview", icon: Eye },
];

const providerRows = [
  {
    name: "Google Drive",
    detail: "Browse My Drive folders, upload into selected folders, preview files, move, and delete.",
    icon: Cloud,
    stat: "OAuth + folders",
    tone: "border-red-500/25 bg-red-500/10 text-red-200",
  },
  {
    name: "Telegram",
    detail: "Store files through user sessions with app-managed quota and provider-aware metadata.",
    icon: Bot,
    stat: "GramJS sessions",
    tone: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  },
  {
    name: "AWS S3",
    detail: "Keep the existing S3 backend as a stable admin-shared storage provider.",
    icon: HardDrive,
    stat: "Shared storage",
    tone: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
];

const Landing = () => {
  const { accessToken, user } = useTypedSelector((state) => state.auth);
  const isSignedIn = Boolean(accessToken && user);
  const primaryHref = isSignedIn ? PROTECTED_ROUTES.FILES : AUTH_ROUTES.SIGN_UP;
  const secondaryHref = isSignedIn
    ? PROTECTED_ROUTES.OVERVIEW
    : AUTH_ROUTES.SIGN_IN;

  return (
    <div className="min-h-screen overflow-hidden bg-[#070202] text-white">
      <section className="relative min-h-[92svh] overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,72,80,.22),transparent_24%),linear-gradient(135deg,#080202_0%,#170506_45%,#390a0d_76%,#71161b_120%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:96px_96px]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,.08),transparent)]" />

        <div className="cloudnest-rain-line left-[18%]" />
        <div className="cloudnest-rain-line left-[34%] hidden sm:block" />
        <div className="cloudnest-rain-line left-[49%]" />
        <div className="cloudnest-rain-line right-[28%] hidden sm:block" />
        <div className="cloudnest-rain-line right-[13%]" />

        <div className="cloudnest-small-cloud cloudnest-small-cloud-a left-[13%] top-[31%] hidden md:block" />
        <div className="cloudnest-small-cloud cloudnest-small-cloud-b right-[12%] top-[32%] hidden md:block" />
        <div className="cloudnest-small-cloud cloudnest-small-cloud-c left-[23%] bottom-[25%] hidden lg:block" />
        <div className="cloudnest-small-cloud cloudnest-small-cloud-d right-[28%] bottom-[22%] hidden xl:block" />
        <div className="cloudnest-small-cloud cloudnest-small-cloud-e left-[36%] top-[22%] hidden xl:block" />

        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-[8px] border border-red-400/30 bg-red-500/15 text-red-100">
              <Cloud className="size-5" />
            </span>
            <span className="text-2xl font-bold leading-none">
              cloud<span className="text-red-500">nest</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/68 lg:flex">
            {navItems.map((item) => (
              item.href.startsWith("/") ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="transition hover:text-white"
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {item.label}
                </a>
              )
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {!isSignedIn && (
              <Button
                asChild
                variant="outline"
                className="hidden rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link to={AUTH_ROUTES.SIGN_IN}>Sign in</Link>
              </Button>
            )}
            <Button
              asChild
              className="rounded-[8px] bg-red-500 text-white hover:bg-red-400"
            >
              <Link to={primaryHref}>
                {isSignedIn ? "Open files" : "Get started"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex min-h-[calc(92svh-190px)] max-w-7xl flex-col items-center justify-center px-5 pb-8 pt-8 text-center sm:px-8 lg:pb-10">
          <div className="cloudnest-face-cloud mb-9" aria-hidden="true">
            <span />
            <span />
          </div>

          <div className="mb-5 inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
            <KeyRound className="size-4 text-red-200" />
            Multi-provider storage control plane
          </div>

          <h1 className="text-5xl font-semibold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            CloudNest
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            One clean place to manage users, API keys, folders, previews, and
            uploads across Google Drive, Telegram, and AWS S3.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-[8px] bg-red-500 px-5 text-white hover:bg-red-400"
            >
              <Link to={primaryHref}>
                {isSignedIn ? "Open workspace" : "Start building"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-[8px] border-white/15 bg-white/[0.04] px-5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to={secondaryHref}>
                {isSignedIn ? "View dashboard" : "Sign in"}
              </Link>
            </Button>
          </div>
        </main>

        <div className="relative z-20 mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 pb-6 sm:px-8 md:grid-cols-4">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="flex items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/80 backdrop-blur-md"
            >
              <provider.icon className={`size-4 ${provider.tone}`} />
              <span>{provider.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        id="platform"
        className="relative overflow-hidden border-b border-white/10 bg-[#100303] px-5 py-20 sm:px-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,72,80,.18),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(130,20,28,.5),transparent_34%),linear-gradient(180deg,#0a0202,#220707_54%,#100303)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:88px_88px]" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-red-200">Control surface</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              A storage layer admins can actually operate.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
              CloudNest keeps account auth, quota state, provider health, file
              movement, and public API access in one restrained dashboard.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-2 gap-3">
              <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
                <Users className="mb-4 size-5 text-red-200" />
                <div className="text-2xl font-semibold">Admin</div>
                <div className="mt-1 text-sm text-white/55">users, roles, keys</div>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
                <Activity className="mb-4 size-5 text-emerald-200" />
                <div className="text-2xl font-semibold">Live</div>
                <div className="mt-1 text-sm text-white/55">usage and health</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {flowSteps.map((step, index) => (
                  <div
                    key={step.label}
                    className="relative rounded-[8px] border border-white/10 bg-black/25 p-4 text-center"
                  >
                    <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[8px] bg-red-500/15 text-red-100">
                      <step.icon className="size-5" />
                    </div>
                    <div className="text-sm font-medium text-white">{step.label}</div>
                    {index < flowSteps.length - 1 && (
                      <ArrowRight className="absolute -right-4 top-1/2 hidden size-4 -translate-y-1/2 text-white/30 sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-[8px] bg-red-500/15 text-red-200">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="providers"
        className="relative overflow-hidden border-b border-white/10 bg-[#100303] px-5 py-20 sm:px-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_12%,rgba(255,72,80,.16),transparent_30%),linear-gradient(135deg,#0a0202,#250708_50%,#4a1014_120%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:88px_88px]" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-red-200">Provider mesh</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Enable only the storage backends you want.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
              CloudNest keeps provider auth, folders, file previews, delete,
              move, and downloads behind a consistent interface.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
                <LockKeyhole className="size-4 text-red-200" />
                Encrypted tokens
              </span>
              <Link
                to={PUBLIC_ROUTES.SDK}
                className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <KeyRound className="size-4 text-red-200" />
                SDK guide
              </Link>
              <a
                href="https://github.com/xgauravyaduvanshii/cloudnest"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <Github className="size-4 text-red-200" />
                GitHub
              </a>
            </div>
          </div>

          <div className="grid gap-3">
            {providerRows.map((provider) => (
              <div
                key={provider.name}
                className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-[8px] border ${provider.tone}`}>
                      <provider.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {provider.name}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        {provider.detail}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-[8px] border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/65">
                    {provider.stat}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#100303] px-5 py-20 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,54,66,.16),transparent_36%),linear-gradient(180deg,#120303,#070707_58%,#170404)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="relative mx-auto flex min-h-[360px] max-w-5xl items-center justify-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 520 520"
            className="absolute h-[min(88vw,520px)] w-[min(88vw,520px)] text-white opacity-[0.13]"
          >
            <circle cx="260" cy="260" r="204" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="260" cy="260" r="164" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 9" />
            <circle cx="260" cy="260" r="88" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M260 56v408M56 260h408M116 116l288 288M404 116 116 404" fill="none" stroke="currentColor" strokeWidth="1" opacity=".7" />
            <path d="M260 92 382 164v144L260 428 138 308V164z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M260 132 344 182v102l-84 84-84-84V182z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M188 320c42-20 102-20 144 0M178 186c44 28 120 28 164 0M202 146c10 42 106 42 116 0M202 374c10-42 106-42 116 0" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M260 186 324 298H196z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M260 226 292 282h-64z" fill="currentColor" opacity=".12" />
            {[
              [260, 56],
              [382, 164],
              [382, 308],
              [260, 428],
              [138, 308],
              [138, 164],
              [260, 186],
              [324, 298],
              [196, 298],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="currentColor" />
            ))}
          </svg>

          <div className="relative z-10 text-center">
            <p className="mb-4 text-sm font-medium text-white/35">cloud storage platform</p>
            <h2 className="text-6xl font-semibold leading-none text-white/10 sm:text-8xl lg:text-9xl">
              CloudNest
            </h2>
            <div className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/55">
              <Cloud className="size-4 text-red-200" />
              <span>One gateway for every enabled storage provider.</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070202] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="text-xl font-bold">
            cloud<span className="text-red-500">nest</span>
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-white/55">
            {footerLinks.map((link) => (
              <Link key={link.href} to={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
