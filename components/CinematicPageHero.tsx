import type { ReactNode } from "react";

export type CinematicHeroStat = {
  label: string;
  value: string;
  detail?: string;
};

interface CinematicPageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt?: string;
  imageContain?: boolean;
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
  panelEyebrow,
  panelTitle,
  panelDescription,
  stats = [],
  actions,
  children,
}: CinematicPageHeroProps) {
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

        <div className="jh-page-media">
          <img
            src={imageSrc}
            alt={imageAlt}
            className={`jh-page-media-img${imageContain ? " contain" : ""}`}
          />
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
