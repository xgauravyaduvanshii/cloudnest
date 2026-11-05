import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Check,
  Cloud,
  Code2,
  Copy,
  Github,
  HardDrive,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageSquare,
  Search,
  Server,
  ShieldCheck,
  UploadCloud,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo/seo";
import {
  CtaBand,
  CodeBlock,
  FeatureCard,
  Section,
  SiteLayout,
} from "@/components/marketing/site-layout";
import { LegalDoc, P, UL } from "@/components/marketing/legal-doc";
import { ContactForm } from "@/components/marketing/contact-form";
import { aiAgentPrompt } from "@/lib/ai-prompt";
import { AUTH_ROUTES, PUBLIC_ROUTES } from "@/routes/common/routePath";
import { SITE_URL } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Couldn't access the clipboard");
        }
      }}
    >
      {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
};

type Faq = { q: string; a: string };

const FaqList = ({ items }: { items: Faq[] }) => (
  <div className="space-y-3">
    {items.map((item) => (
      <details
        key={item.q}
        className="group rounded-[10px] border border-white/10 bg-white/[0.035] p-5 open:bg-white/[0.05]"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white">
          {item.q}
          <Search className="size-4 shrink-0 text-red-200 transition group-open:rotate-90" />
        </summary>
        <p className="mt-3 text-sm leading-7 text-white/60">{item.a}</p>
      </details>
    ))}
  </div>
);

const faqJsonLd = (items: Faq[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const cardGrid = "mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3";

/* ------------------------------------------------------------------ */
/* SDK                                                                 */
/* ------------------------------------------------------------------ */

export const SDKPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.SDK}
      title="CloudNest SDK — upload & manage files from your app"
      description="Install @cloudnest/sdk and upload, list, preview, download, and delete files across Google Drive, Telegram, and S3 with an API key. Node, browser, and REST examples."
      keywords={[
        "cloudnest sdk",
        "@cloudnest/sdk",
        "file upload api",
        "google drive upload api",
        "s3 upload sdk",
      ]}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "CloudNest SDK",
        url: `${SITE_URL}/sdk`,
        profiler: "TypeScript",
      }}
    />
    <SiteLayout
      eyebrow="CloudNest SDK"
      title="Upload, list, and manage files from your app."
      description="One SDK and API key, with the backend routing storage to whichever providers your admin has enabled."
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="min-w-0">
          <Section title="Quick start" lead="Three steps to your first upload.">
            <ol className="mt-2 space-y-4">
              {[
                ["Create an API key", "Generate a key in the dashboard and store it as CLOUDNEST_API_KEY."],
                ["Install the SDK", "npm install @cloudnest/sdk — the official package (not cloudnest-sdk)."],
                ["Upload a file", "Pick a provider your admin enabled, e.g. GOOGLE_DRIVE."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-sm font-semibold text-red-200">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-white">{t}</div>
                    <div className="text-sm text-white/60">{b}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <div className="mt-8 flex flex-wrap gap-2">
            <Link to={PUBLIC_ROUTES.AI_PROMPT}>
              <Button variant="outline" size="sm" className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                <Bot className="mr-1 size-4" /> AI agent prompt
              </Button>
            </Link>
            <a href="/llms.txt" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                llms.txt
              </Button>
            </a>
            <a href="/llms-full.txt" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                llms-full.txt
              </Button>
            </a>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="flex justify-end">
            <CopyButton text={`npm install @cloudnest/sdk`} />
          </div>
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

console.log(result.data[0].fileId);`}</CodeBlock>
          <CodeBlock>{`// Choose an enabled provider: S3 | GOOGLE_DRIVE | TELEGRAM
await cloudnest.uploadFiles(file, { provider: "S3" });

await cloudnest.uploadFiles(file, {
  provider: "GOOGLE_DRIVE",
  storageAccountId: "account-id",
  providerFolderId: "drive-folder-id",
});

// File management with API keys
const files = await cloudnest.listFiles({ provider: "GOOGLE_DRIVE" });
const preview = await cloudnest.getPreviewUrl("file-id");
const playable = await cloudnest.getPlayableUrl("file-id");
await cloudnest.deleteFile("file-id");`}</CodeBlock>
        </div>
      </div>

      <Section
        id="sdk-providers"
        title="Provider matrix"
        lead="Every call uses the same interface; the destination changes with the provider you pass."
      >
        <div className={cardGrid}>
          <FeatureCard icon={Cloud} title="Google Drive" body="Connect an account, browse folders, upload, preview, move, delete, and sync usage." />
          <FeatureCard icon={Bot} title="Telegram" body="Store files through user sessions with app-managed soft quota and provider metadata." />
          <FeatureCard icon={HardDrive} title="AWS S3" body="Use a stable, admin-shared bucket as a storage backend when enabled." />
        </div>
      </Section>

      <div className="mt-14">
        <Section title="SDK FAQ">
          <FaqList
            items={[
              { q: "Which package name is correct?", a: "The official package is @cloudnest/sdk. Do not use similarly named packages like cloudnest-sdk." },
              { q: "Can I upload from the browser?", a: "Yes, but never expose privileged production keys in a public bundle. Prefer a backend proxy that reads CLOUDNEST_API_KEY server-side." },
              { q: "What if a provider is disabled?", a: "Admins can disable providers. A disabled provider won't accept uploads, so pass a provider that is enabled for your account." },
              { q: "How do I preview or play media?", a: "Use getPreviewUrl(fileId) for inline previews and getPlayableUrl(fileId) for video/audio; if canPlay is true, use playUrl as the media src." },
            ]}
          />
        </Section>
      </div>

      <CtaBand
        title="Start uploading with one API."
        body="Create an account, generate an API key, and route files to any enabled provider."
      />
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* AI Prompt                                                           */
/* ------------------------------------------------------------------ */

export const AIPromptPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.AI_PROMPT}
      title="CloudNest AI Agent Integration Prompt"
      description="A public, copy-ready prompt that gives Claude, Codex, Cursor, and other coding agents the full context to integrate CloudNest uploads via @cloudnest/sdk."
      keywords={["ai agent prompt", "cloudnest sdk", "coding agent", "llms.txt", "ai integration"]}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "CloudNest AI Agent Integration Prompt",
        url: `${SITE_URL}/ai-prompt`,
      }}
    />
    <SiteLayout
      eyebrow="AI Agent Prompt"
      title="Give any coding agent the full CloudNest context."
      description="A public, copy-ready prompt for Claude, Codex, Cursor, Windsurf, and other agents that need to add CloudNest uploads to a project."
    >
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="min-w-0 space-y-4">
          <FeatureCard icon={KeyRound} title="Public" body="No login required. Agents can read this page, /llms.txt, /llms-full.txt, or /ai-prompt.md." />
          <FeatureCard icon={Code2} title="SDK-first" body="Points agents to @cloudnest/sdk and the hosted API base URL." />
          <FeatureCard icon={Cloud} title="Provider-aware" body="Explains S3, Google Drive, Telegram, storage accounts, and disabled providers." />
          <FeatureCard icon={LockKeyhole} title="Secret-safe" body="Instructs agents to use environment variables and never commit API keys." />
          <div className="rounded-[10px] border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold">Agent-readable files</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a className="text-red-200 underline" href="/llms.txt" target="_blank" rel="noreferrer">/llms.txt</a>
              <a className="text-red-200 underline" href="/llms-full.txt" target="_blank" rel="noreferrer">/llms-full.txt</a>
              <a className="text-red-200 underline" href="/ai-prompt.md" target="_blank" rel="noreferrer">/ai-prompt.md</a>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">The prompt</h2>
            <CopyButton text={aiAgentPrompt} label="Copy prompt" />
          </div>
          <CodeBlock>{aiAgentPrompt}</CodeBlock>
        </div>
      </div>
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* Privacy Policy                                                      */
/* ------------------------------------------------------------------ */

export const PrivacyPolicyPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.PRIVACY}
      title="Privacy Policy"
      description="How CloudNest collects, uses, protects, and retains your data — including account data, file metadata, encrypted provider credentials, OAuth tokens, and cookies."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "PrivacyPolicy",
        name: "CloudNest Privacy Policy",
        url: `${SITE_URL}/privacy-policy`,
      }}
    />
    <SiteLayout
      eyebrow="Privacy Policy"
      title="How CloudNest handles your data."
      description="A clear account of what we collect, why, how we protect provider credentials, and the choices you have."
    >
      <LegalDoc
        updated="January 1, 2025"
        intro={<P>CloudNest is a multi-provider storage control plane. This policy explains the personal data we process to operate uploads, previews, downloads, authentication, and administration — and how we safeguard sensitive provider credentials.</P>}
        sections={[
          {
            id: "data-we-collect",
            title: "Data we collect",
            body: (
              <>
                <P>We process only what is needed to run the platform:</P>
                <UL
                  items={[
                    "Account data: name, email, hashed password, role, status, and quota settings.",
                    "File metadata: names, sizes, extensions, MIME types, folder structure, provider ids, and preview metadata so files can be listed, moved, downloaded, and deleted.",
                    "Provider account metadata: connected account email/ids used to route storage.",
                    "Usage and activity logs: uploads, downloads, admin actions, and security events for audit and troubleshooting.",
                    "Support data: contact requests and their status, plus any message you send us.",
                  ]}
                />
              </>
            ),
          },
          {
            id: "provider-credentials",
            title: "Provider credentials & OAuth tokens",
            body: (
              <>
                <P>Connecting Google Drive, Telegram, or S3 involves sensitive credentials. We protect them aggressively:</P>
                <UL
                  items={[
                    "Google OAuth refresh/access tokens, Telegram sessions, and S3 secrets are encrypted at rest using the backend encryption key.",
                    "Stored credentials are write-only from the admin UI — once saved they cannot be read back in plaintext.",
                    "Tokens are used only to perform actions on your behalf against the provider you connected, and are never sold or shared.",
                    "Disconnecting an account revokes our stored session and clears cached credentials.",
                  ]}
                />
              </>
            ),
          },
          {
            id: "how-we-use",
            title: "How we use data",
            body: (
              <UL
                items={[
                  "Provide storage, authentication, previews, playback, sharing, and downloads.",
                  "Enforce quotas, provider enablement, and access control.",
                  "Maintain security, detect abuse, and produce audit trails.",
                  "Operate support workflows and respond to your requests.",
                  "With consent only, measure aggregate usage to improve the product.",
                ]}
              />
            ),
          },
          {
            id: "cookies",
            title: "Cookies & consent",
            body: (
              <>
                <P>CloudNest uses strictly necessary cookies and local storage to keep you signed in, secure sessions, and remember UI preferences. These cannot be disabled.</P>
                <P>Optional analytics and marketing cookies are only set with your consent. You can accept, reject, or manage categories at any time from the cookie banner or the “Cookie settings” link in the footer. Your choice is stored locally on your device.</P>
              </>
            ),
          },
          {
            id: "retention",
            title: "Data retention",
            body: (
              <P>Account and file metadata are retained while your account is active and for a limited period after deletion to honor backups and legal obligations. Deleting a file removes its metadata and instructs the provider to delete the stored object. Activity logs are retained on a rolling basis for security auditing.</P>
            ),
          },
          {
            id: "your-rights",
            title: "Your rights",
            body: (
              <UL
                items={[
                  "Access and export the data associated with your account.",
                  "Correct inaccurate profile data from settings.",
                  "Delete your files and, on request, your account.",
                  "Withdraw cookie consent at any time via Cookie settings.",
                  "Object to or restrict certain processing where lawful.",
                ]}
              />
            ),
          },
          {
            id: "sub-processors",
            title: "Sub-processors",
            body: (
              <P>To deliver the service we rely on infrastructure and provider partners you choose to enable — Google (Drive), Telegram, and Amazon (S3) — plus the hosting that runs CloudNest. Each provider’s own terms and privacy policy also apply to data stored with them.</P>
            ),
          },
          {
            id: "security",
            title: "Security",
            body: (
              <P>We use encryption at rest for credentials, hashed passwords, least-privilege access, and admin audit logs. No system is perfectly secure; if a breach affects your data we will notify you as required by law. See our Security page for details.</P>
            ),
          },
          {
            id: "contact-privacy",
            title: "Contact",
            body: (
              <P>Questions about privacy? Use the <Link to={PUBLIC_ROUTES.CONTACT} className="text-red-200 underline">contact form</Link> and reference “Privacy”. Please never send secrets or tokens in a support message.</P>
            ),
          },
        ]}
      />
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* Terms                                                               */
/* ------------------------------------------------------------------ */

export const TermsPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.TERMS}
      title="Terms and Conditions"
      description="The rules for using CloudNest: acceptable use, account and provider responsibility, API key security, availability, limits, liability, and termination."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "TermsOfService",
        name: "CloudNest Terms and Conditions",
        url: `${SITE_URL}/terms-and-conditions`,
      }}
    />
    <SiteLayout
      eyebrow="Terms and Conditions"
      title="Rules for using CloudNest."
      description="These terms describe what we expect of you, what you can expect from us, and the limits of the platform."
    >
      <LegalDoc
        updated="January 1, 2025"
        intro={<P>By creating an account or using CloudNest you agree to these terms. They apply to the dashboard, the API, and the SDK.</P>}
        sections={[
          { id: "accounts", title: "Your account", body: <P>You must provide accurate information, keep your credentials secure, and restrict access to your account. You are responsible for activity under your account and API keys.</P> },
          {
            id: "acceptable-use",
            title: "Acceptable use",
            body: (
              <UL
                items={[
                  "Do not upload illegal, abusive, harassing, infringing, malicious, or harmful content.",
                  "Do not attempt to disrupt, overload, reverse-engineer, or gain unauthorized access to the platform.",
                  "Do not use the service to violate any applicable law or third-party rights.",
                ]}
              />
            ),
          },
          {
            id: "provider-responsibility",
            title: "Provider accounts",
            body: <P>You are responsible for the Google Drive, Telegram, and AWS S3 accounts you connect and for complying with each provider’s terms, quotas, and policies. Provider-side limits and outages are outside CloudNest’s control.</P>,
          },
          {
            id: "api-keys",
            title: "API keys & security",
            body: <P>Keep API keys secret. Do not hardcode or expose privileged keys in public clients. Revoke compromised keys immediately from the dashboard. You are liable for actions taken with your keys.</P>,
          },
          {
            id: "availability",
            title: "Availability & limits",
            body: <P>The service is provided on an “as available” basis. Provider quotas, rate limits, credential expiry, and third-party outages can affect uploads, previews, and downloads. We may apply fair-use and rate limits to protect the platform.</P>,
          },
          {
            id: "ip",
            title: "Your content",
            body: <P>You retain all rights to files you store. You grant CloudNest a limited license to store and process them solely to provide the service.</P>,
          },
          {
            id: "liability",
            title: "Disclaimers & liability",
            body: <P>The service is provided “as is” without warranties beyond those required by law. To the maximum extent permitted, CloudNest is not liable for indirect or consequential losses, provider data loss, or service interruptions.</P>,
          },
          {
            id: "termination",
            title: "Termination",
            body: <P>You may stop using and delete your account at any time. We may suspend or terminate access that breaches these terms or endangers the platform or other users.</P>,
          },
          {
            id: "changes",
            title: "Changes to these terms",
            body: <P>We may update these terms. Material changes will be announced through the product or a notice. Continued use after changes take effect constitutes acceptance.</P>,
          },
          {
            id: "contact-terms",
            title: "Contact",
            body: <P>Reach us through the <Link to={PUBLIC_ROUTES.CONTACT} className="text-red-200 underline">contact form</Link> for anything regarding these terms.</P>,
          },
        ]}
      />
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

export const SecurityPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.SECURITY}
      title="Security"
      description="How CloudNest protects provider credentials, OAuth tokens, and data: encryption at rest, write-only secrets, least-privilege access, API key revocation, and audit trails."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "CloudNest Security",
        url: `${SITE_URL}/security`,
      }}
    />
    <SiteLayout
      eyebrow="Security"
      title="Provider secrets stay protected."
      description="CloudNest is built around encrypted credentials, least-privilege access, admin controls, audit records, and fast key revocation."
    >
      <div className={cardGrid}>
        <FeatureCard icon={LockKeyhole} title="Encryption at rest" body="OAuth refresh tokens, Telegram sessions, and provider secrets are encrypted with the backend encryption key and are write-only from the UI." />
        <FeatureCard icon={KeyRound} title="API key lifecycle" body="Keys are created scoped to a user, shown once, and can be rotated or revoked instantly from the dashboard." />
        <FeatureCard icon={ShieldCheck} title="Least privilege" body="Users only access their own files and accounts. Admin capabilities are role-gated and audited." />
        <FeatureCard icon={Server} title="Audit trail" body="Admin actions on users, files, providers, notices, and requests are recorded for review." />
        <FeatureCard icon={Users} title="Access control" body="Session and JWT handling enforce authentication, expiry, and authorization on every route." />
        <FeatureCard icon={Cloud} title="Credential recovery" body="If a Google grant is revoked, you get a clear reconnect flow — a transient blip never silently drops your account." />
      </div>

      <div className="mt-14">
        <LegalDoc
          sections={[
            { id: "how-creds", title: "How credentials are protected", body: <P>When you connect a provider, CloudNest encrypts the resulting token or session before storing it. Secrets are never returned to the browser in plaintext after saving, and TLS protects data in transit.</P> },
            { id: "shared-resp", title: "Shared responsibility", body: <P>CloudNest secures the control plane; providers secure the underlying storage. Keep your own Google, Telegram, and AWS accounts protected with strong authentication.</P> },
            { id: "disclosure", title: "Responsible disclosure", body: <P>Found a vulnerability? Report it privately via the <Link to={PUBLIC_ROUTES.CONTACT} className="text-red-200 underline">contact form</Link> without exposing it publicly. We aim to acknowledge reports promptly and will never take legal action against good-faith research.</P> },
          ]}
        />
      </div>

      <CtaBand title="Security you can build on." body="Connect providers knowing credentials are encrypted, audited, and revocable." primaryHref={AUTH_ROUTES.SIGN_UP} />
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */

export const AboutPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.ABOUT}
      title="About CloudNest"
      description="CloudNest is a storage control plane unifying web and SDK uploads, provider routing, admin management, previews, folders, and downloads across Google Drive, Telegram, and AWS S3."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About CloudNest",
        url: `${SITE_URL}/about`,
      }}
    />
    <SiteLayout
      eyebrow="About"
      title="CloudNest is a storage control plane."
      description="One experience for users and admins; many storage backends underneath."
    >
      <Section
        title="Our mission"
        lead="Teams shouldn't have to rewrite their file layer every time the cheapest or most compliant storage backend changes. CloudNest keeps one user and file experience while swapping Google Drive, Telegram, and AWS S3 behind the scenes."
      >
        <div className={cardGrid}>
          <FeatureCard icon={Cloud} title="Provider-agnostic" body="Upload once; route to any enabled provider. Admins decide which backends are live." />
          <FeatureCard icon={UploadCloud} title="Developer-friendly" body="A typed SDK and REST API with API keys, folders, previews, playback, and downloads." />
          <FeatureCard icon={Users} title="Admin-operated" body="Quotas, roles, provider settings, keys, notices, and support requests in one dashboard." />
        </div>
      </Section>

      <div className="mt-12">
        <Section title="How it is built" lead="A pragmatic architecture that stays secure and auditable.">
          <UL
            items={[
              "React dashboard and an Express/Postgres backend with JWT auth and role-based access.",
              "A provider abstraction layer for S3, Google Drive, and Telegram with consistent folder and file operations.",
              "Encrypted credential storage at rest and admin audit logging.",
              "An official npm SDK (@cloudnest/sdk) that mirrors the public API used by the dashboard.",
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="https://github.com/xgauravyaduvanshii/cloudnest" target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-[8px] border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                <Github className="mr-2 size-4" /> View source
              </Button>
            </a>
            <Link to={PUBLIC_ROUTES.SDK}>
              <Button className="rounded-[8px] bg-red-500 text-white hover:bg-red-400">
                Explore the SDK
              </Button>
            </Link>
          </div>
        </Section>
      </div>

      <CtaBand title="Make storage a detail, not a decision." body="Try CloudNest and connect the providers you already use." primaryHref={AUTH_ROUTES.SIGN_UP} />
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* Help                                                                */
/* ------------------------------------------------------------------ */

const helpFaqs: Faq[] = [
  { q: "My Google Drive upload failed.", a: "Check that the Google account is connected and active, the Drive API is enabled for the OAuth app, and the redirect URI matches. If access was revoked, use Reconnect Google Drive." },
  { q: "How do I set up Telegram?", a: "Create an API ID and API hash at my.telegram.org, then connect a user session with the OTP code (and 2FA password if enabled)." },
  { q: "A provider I expect is missing.", a: "Admins can disable providers. Disabled providers won't appear in upload choices or accept SDK uploads." },
  { q: "Preview won't load.", a: "Confirm the file still exists in the provider account and that the account's token or session is healthy, then re-sync the account." },
  { q: "Can I hide my API key from the browser?", a: "Yes. For production apps, proxy uploads through your own backend that reads CLOUDNEST_API_KEY server-side rather than shipping the key to the client." },
  { q: "How do I get support?", a: "Use the contact form. Sign in first and the request appears under Support → My requests with its live status." },
  { q: "What happens if my Google access expires?", a: "You'll be prompted to reconnect. A temporary rate-limit or network blip will not drop your account — browsing recovers automatically." },
  { q: "How are credentials stored?", a: "Encrypted at rest and write-only from the UI. See the Security page for details." },
];

export const HelpPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.HELP}
      title="Help Center & FAQ"
      description="Answers to common CloudNest questions on provider setup, Google Drive and Telegram connections, uploads, previews, API keys, quotas, and support."
      jsonLd={faqJsonLd(helpFaqs)}
    />
    <SiteLayout
      eyebrow="Help Center"
      title="Answers, fast."
      description="Common setup, upload, and account questions — grouped by topic. Still stuck? Contact us and track the answer in your dashboard."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FeatureCard icon={Cloud} title="Providers" body="Google Drive, Telegram, S3 setup and troubleshooting." />
        <FeatureCard icon={UploadCloud} title="Uploads & files" body="Previews, playback, downloads, and folder behavior." />
        <FeatureCard icon={KeyRound} title="Keys & security" body="API keys, browser safety, and credential handling." />
      </div>

      <div className="mt-10">
        <Section title="Frequently asked questions">
          <FaqList items={helpFaqs} />
        </Section>
      </div>

      <div className="mt-12 rounded-[12px] border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <LifeBuoy className="size-6 text-red-200" />
            <div>
              <h2 className="text-lg font-semibold">Still need help?</h2>
              <p className="text-sm text-white/60">Send a request and follow its status in your dashboard.</p>
            </div>
          </div>
          <Link to={PUBLIC_ROUTES.CONTACT}>
            <Button className="rounded-[8px] bg-red-500 text-white hover:bg-red-400">
              <MessageSquare className="mr-2 size-4" /> Contact support
            </Button>
          </Link>
        </div>
      </div>
    </SiteLayout>
  </>
);

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

export const ContactPage = () => (
  <>
    <Seo
      path={PUBLIC_ROUTES.CONTACT}
      title="Contact CloudNest"
      description="Reach the CloudNest team about setup, provider issues, bugs, or private deployments. Sign in to link your request to your account and track its status."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact CloudNest",
        url: `${SITE_URL}/contact`,
      }}
    />
    <SiteLayout
      eyebrow="Contact"
      title="How can we help?"
      description="Tell us what's happening — the error you saw, what you expected, and how to reproduce it. We'll respond by email."
    >
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-6">
          <ContactForm />
        </div>
        <div className="space-y-4">
          <FeatureCard
            icon={MessageSquare}
            title="Track your requests"
            body={
              <>
                Sign in before submitting and the request is linked to your account. Follow its status — New, Approved, In progress, Solved — under{" "}
                <span className="text-white/85">Support → My requests</span>.
              </>
            }
          />
          <FeatureCard
            icon={Mail}
            title="Response by email"
            body="We reply to the email you provide. Please don't include API keys, OAuth tokens, Telegram sessions, or passwords."
          />
          <a
            href="https://github.com/xgauravyaduvanshii/cloudnest"
            target="_blank"
            rel="noreferrer"
            className="block rounded-[10px] border border-white/10 bg-white/[0.035] p-6 transition hover:bg-white/[0.06]"
          >
            <Github className="mb-4 size-6 text-red-200" />
            <h2 className="text-lg font-semibold">GitHub</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              For source, issues, and implementation discussion. Keep deployment
              secrets out of public threads.
            </p>
          </a>
        </div>
      </div>
    </SiteLayout>
  </>
);
