import type { ReactNode } from "react";

type PageHeroProps = {
  /** Small label above the title, for example "Jobs". */
  label: string;
  title: string;
  description?: string;
  /** Optional content under the text, for example a search form. */
  children?: ReactNode;
  /** Optional element on the right, for example a button. */
  action?: ReactNode;
};

/** Navy title band used at the top of signed-in pages. Pair with <PageBody>. */
export function PageHero({
  label,
  title,
  description,
  children,
  action,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#0E1726] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#A9C1FF]">
              {label}
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="text-base text-[#C7D0DD] sm:text-lg">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Content area that overlaps the bottom of the hero band. Same width as the header and hero. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-[1200px] px-4 pb-16 sm:px-6">
      {children}
    </div>
  );
}

/** White rounded surface used for lists, forms and panels. */
export function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#E3E6EB] bg-white ${className}`}
    >
      {children}
    </div>
  );
}
