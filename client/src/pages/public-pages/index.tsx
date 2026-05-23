import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Cloud,
  Code2,
  Github,
  LifeBuoy,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES, PUBLIC_ROUTES } from "@/routes/common/routePath";

type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const publicLinks = [
  { label: "SDK", href: PUBLIC_ROUTES.SDK },
  { label: "Help", href: PUBLIC_ROUTES.HELP },
  { label: "Contact", href: PUBLIC_ROUTES.CONTACT },
  { label: "Privacy", href: PUBLIC_ROUTES.PRIVACY },
  { label: "Terms", href: PUBLIC_ROUTES.TERMS },
  { label: "Security", href: PUBLIC_ROUTES.SECURITY },
];

const PageShell = ({ eyebrow, title, description, children }: PublicPageProps) => (
  <div className="min-h-screen bg-[#070202] text-white">
    <section className="relative overflow-hidden border-b border-white/10 px-5 py-5 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,72,80,.22),transparent_28%),linear-gradient(135deg,#080202_0%,#190505_48%,#451015_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:88px_88px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[8px] border border-red-400/30 bg-red-500/15 text-red-100">
            <Cloud className="size-5" />
          </span>
          <span className="text-2xl font-bold leading-none">
            cloud<span className="text-red-500">nest</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="hidden rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Link to={AUTH_ROUTES.SIGN_IN}>Sign in</Link>
          </Button>
          <Button asChild className="rounded-[8px] bg-red-500 text-white hover:bg-red-400">
            <Link to={AUTH_ROUTES.SIGN_UP}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl py-20">
        <p className="text-sm font-medium text-red-200">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
          {description}
        </p>
      </div>
    </section>

    <main className="bg-[linear-gradient(180deg,#0b0303,#180506_45%,#080303)] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>

    <footer className="border-t border-white/10 bg-[#070202] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="text-xl font-bold">
          cloud<span className="text-red-500">nest</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-white/55">
          {publicLinks.map((link) => (
            <Link key={link.href} to={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  </div>
);

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-[8px] border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/75">
    <code>{children}</code>
  </pre>
);

export const SDKPage = () => (
  <PageShell
    eyebrow="CloudNest SDK"
    title="Upload, list, and manage files from your app."
    description="Use the CloudNest SDK with API keys while the backend routes storage to enabled providers."
  >
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-4">
        {[
          ["Install", "Add the official @cloudnest/sdk package to your Node or browser app."],
          ["Create a client", "Pass your CloudNest API base URL and API key."],
          ["Upload files", "Send provider, folder, and storage account options when needed."],
          ["Use responses", "Read file ids, public view URLs, provider, and metadata."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <CodeBlock>{`npm install @cloudnest/sdk`}</CodeBlock>
        <CodeBlock>{`import { CloudNestClient } from "@cloudnest/sdk";

const cloudnest = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: process.env.CLOUDNEST_API_KEY,
});

const result = await cloudnest.uploadFiles(file, {
  provider: "GOOGLE_DRIVE",
  providerFolderId: "optional-google-drive-folder-id",
});

console.log(result.files[0].url);`}</CodeBlock>
        <CodeBlock>{`await cloudnest.uploadFiles(file, {
  provider: "S3", // S3 | GOOGLE_DRIVE | TELEGRAM
});

await cloudnest.uploadFiles(file, {
  provider: "GOOGLE_DRIVE",
  storageAccountId: "account-id",
  providerFolderId: "drive-folder-id",
});`}</CodeBlock>
      </div>
    </div>
  </PageShell>
);

export const PrivacyPolicyPage = () => (
  <PageShell
    eyebrow="Privacy Policy"
    title="How CloudNest handles your data."
    description="A clear overview of the data CloudNest needs to provide storage, authentication, previews, and account management."
  >
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ["Account data", "We store account profile details, roles, quotas, and authentication metadata needed to operate the app."],
        ["Provider credentials", "Google refresh tokens, Telegram sessions, and provider secrets are encrypted and treated as write-only from the admin interface."],
        ["Files and metadata", "File names, sizes, folders, provider ids, and preview metadata are stored so files can be listed, moved, deleted, and downloaded."],
        ["Access logs", "Admin and provider actions may be logged for audit, security, and troubleshooting."],
      ].map(([title, body]) => (
        <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
      ))}
    </div>
  </PageShell>
);

export const TermsPage = () => (
  <PageShell
    eyebrow="Terms and Conditions"
    title="Rules for using CloudNest."
    description="These terms describe acceptable use, account responsibility, provider access, and platform limits."
  >
    <div className="space-y-4">
      {[
        ["Use responsibly", "Do not upload illegal, abusive, infringing, harmful, or unauthorized content."],
        ["Provider accounts", "You are responsible for the Google Drive, Telegram, and AWS S3 accounts you connect."],
        ["Security", "Keep API keys private. Revoke compromised keys immediately from the dashboard."],
        ["Availability", "Provider limits, quotas, outages, or revoked credentials can affect uploads, previews, and downloads."],
      ].map(([title, body]) => (
        <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
      ))}
    </div>
  </PageShell>
);

export const HelpPage = () => (
  <PageShell
    eyebrow="Help Center"
    title="Common CloudNest setup questions."
    description="Quick answers for provider setup, uploads, previews, API keys, and account management."
  >
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ["Google Drive upload failed", "Check Google OAuth credentials, redirect URI, enabled Drive API, and whether the connected account is active."],
        ["Telegram setup", "Use Telegram API ID and API hash from my.telegram.org, then connect a user session with OTP and optional 2FA."],
        ["Provider hidden", "Admins can disable providers. Disabled providers will not appear in user upload choices."],
        ["Preview not loading", "Confirm the file still exists in the provider account and that the account token/session is healthy."],
      ].map(([title, body]) => (
        <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5">
          <LifeBuoy className="mb-4 size-5 text-red-200" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
      ))}
    </div>
  </PageShell>
);

export const ContactPage = () => (
  <PageShell
    eyebrow="Contact"
    title="Need help with CloudNest?"
    description="Use GitHub for source, issues, and implementation discussion. For private deployments, keep credentials out of public messages."
  >
    <div className="grid gap-4 md:grid-cols-2">
      <a
        href="https://github.com/xgauravyaduvanshii/cloudnest"
        target="_blank"
        rel="noreferrer"
        className="rounded-[8px] border border-white/10 bg-white/[0.035] p-6 transition hover:bg-white/[0.06]"
      >
        <Github className="mb-5 size-6 text-red-200" />
        <h2 className="text-xl font-semibold">GitHub</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Open issues, review code, and track project changes.
        </p>
      </a>
      <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-6">
        <Mail className="mb-5 size-6 text-red-200" />
        <h2 className="text-xl font-semibold">Deployment support</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Share environment, provider, and error details without posting API
          secrets, OAuth tokens, or Telegram sessions.
        </p>
      </div>
    </div>
  </PageShell>
);

export const SecurityPage = () => (
  <PageShell
    eyebrow="Security"
    title="Provider secrets stay protected."
    description="CloudNest is designed around encrypted provider credentials, admin controls, audit records, and API key revocation."
  >
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Encryption", "Provider secrets are encrypted with the configured backend encryption key."],
        ["API keys", "Users and admins can create and revoke API keys for upload access."],
        ["Audit trail", "Admin file, user, and provider account actions can be audited."],
      ].map(([title, body]) => (
        <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-5">
          <ShieldCheck className="mb-4 size-5 text-red-200" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
      ))}
    </div>
  </PageShell>
);

export const AboutPage = () => (
  <PageShell
    eyebrow="About"
    title="CloudNest is a storage control plane."
    description="It unifies web uploads, SDK uploads, provider routing, admin management, previews, folders, and downloads across multiple storage backends."
  >
    <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-6">
      <Code2 className="mb-5 size-6 text-red-200" />
      <h2 className="text-xl font-semibold">Built for mixed storage stacks</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        CloudNest lets a product keep one user and file experience while using
        Google Drive, Telegram, and AWS S3 behind the scenes. Admins decide
        which providers are enabled and users work through one dashboard.
      </p>
    </div>
  </PageShell>
);
