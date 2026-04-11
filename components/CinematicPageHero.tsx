import type { ReactNode } from "react";

export type CinematicHeroStat = {
  label: string;
  value: string;
  detail?: string;
};

export type CinematicHeroMediaVariant =
  | "creation"
  | "library"
  | "marketplace"
  | "credits"
  | "network"
  | "join";

const ABSTRACT_MEDIA_LABELS: Record<CinematicHeroMediaVariant, [string, string, string]> = {
  creation: ["Prompt", "Route", "Render"],
  library: ["Save", "Review", "Own"],
  marketplace: ["List", "Trade", "Collect"],
  credits: ["Fund", "Spend", "Convert"],
  network: ["Nodes", "Queue", "Telemetry"],
  join: ["Setup", "Connect", "Operate"],
};

interface CinematicPageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  imageContain?: boolean;
  mediaVariant?: CinematicHeroMediaVariant;
  panelEyebrow?: string;
  panelTitle?: string;
  panelDescription?: string;
  stats?: CinematicHeroStat[];
  actions?: ReactNode;
  children?: ReactNode;
}

export function CinematicPageHero({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt = "",
  imageContain = false,
  mediaVariant = "creation",
  panelEyebrow,
  panelTitle,
  panelDescription,
  stats = [],
  actions,
  children,
}: CinematicPageHeroProps) {
  const abstractLabels = ABSTRACT_MEDIA_LABELS[mediaVariant];

  return (
    <section className="jh-page-hero">
      <div className="jh-page-hero-inner">
        <div className="jh-page-copy">
          <span className="jh-eyebrow">{eyebrow}</span>
          <h1 className="jh-page-title">{title}</h1>
          <p className="jh-page-description">{description}</p>

          {actions ? <div className="jh-hero-actions">{actions}</div> : null}

          {stats.length > 0 ? (
            <div className="jh-page-stats">
              {stats.map((stat) => (
                <div key={`${stat.label}-${stat.value}`} className="jh-page-stat">
                  <span className="jh-page-stat-label">{stat.label}</span>
                  <strong className="jh-page-stat-value">{stat.value}</strong>
                  {stat.detail ? <span className="jh-page-stat-detail">{stat.detail}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {children ? <div className="jh-page-note">{children}</div> : null}
        </div>

        <div
          className={`jh-page-media${imageSrc ? "" : " is-abstract"} jh-page-media-${mediaVariant}`}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={imageAlt}
              className={`jh-page-media-img${imageContain ? " contain" : ""}`}
            />
          ) : (
            <div className="jh-page-media-abstract" aria-hidden="true">
              <div className="jh-page-abstract-grid" />
              <div className="jh-page-abstract-aura aura-a" />
              <div className="jh-page-abstract-aura aura-b" />
              <div className="jh-page-abstract-ring ring-a" />
              <div className="jh-page-abstract-ring ring-b" />
              <div className="jh-page-abstract-slab slab-a" />
              <div className="jh-page-abstract-slab slab-b" />
              <div className="jh-page-abstract-slab slab-c" />
              <div className="jh-page-abstract-trace trace-a" />
              <div className="jh-page-abstract-trace trace-b" />
              <div className="jh-page-abstract-core" />
              <div className="jh-page-abstract-node node-a" />
              <div className="jh-page-abstract-node node-b" />
              <div className="jh-page-abstract-node node-c" />
              <div className="jh-page-abstract-flow">
                {abstractLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          )}
          <div className="jh-page-media-overlay" aria-hidden="true" />

          {(panelEyebrow || panelTitle || panelDescription) && (
            <div className="jh-page-panel">
              {panelEyebrow ? <span className="jh-page-panel-eyebrow">{panelEyebrow}</span> : null}
              {panelTitle ? <h2 className="jh-page-panel-title">{panelTitle}</h2> : null}
              {panelDescription ? <p className="jh-page-panel-description">{panelDescription}</p> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
