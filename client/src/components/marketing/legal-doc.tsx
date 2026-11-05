import { type ReactNode } from "react";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * Renders a legal/informational document: an in-page table of contents plus
 * numbered, anchored sections. Semantic and print/responsive friendly.
 */
export const LegalDoc = ({
  updated,
  intro,
  sections,
}: {
  updated?: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) => {
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Table of contents" className="lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
          On this page
        </p>
        <ol className="mt-3 space-y-2 text-sm">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-white/60 transition hover:text-white"
              >
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
        {updated && (
          <p className="mt-6 text-xs text-white/40">Last updated: {updated}</p>
        )}
      </nav>

      <article className="max-w-3xl space-y-10 text-[15px] leading-7 text-white/70">
        {intro && <div className="space-y-3">{intro}</div>}
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-white">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3">{s.body}</div>
          </section>
        ))}
      </article>
    </div>
  );
};

export const P = ({ children }: { children: ReactNode }) => (
  <p>{children}</p>
);

export const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
);

export default LegalDoc;
