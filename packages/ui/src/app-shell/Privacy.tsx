import { PRIVACY } from "./privacy.ts";

/** The privacy page inside Settings (NFR-5, IN-9), the same words as /privacy. */
export function Privacy() {
  return (
    <div className="ui-privacy">
      <p className="ui-privacy-lead">
        <b>{PRIVACY.lead}</b> {PRIVACY.leadMore}
      </p>
      {PRIVACY.sections.map((s) => (
        <section key={s.title}>
          <h3 className="ui-info-section">{s.title}</h3>
          <p>{s.text}</p>
        </section>
      ))}
      <section>
        <h3 className="ui-info-section">{PRIVACY.questions}</h3>
        <p>
          <a href={`mailto:${PRIVACY.contact}`}>{PRIVACY.contact}</a>
        </p>
      </section>
      <p className="ui-info-version">{PRIVACY.updated}</p>
    </div>
  );
}
