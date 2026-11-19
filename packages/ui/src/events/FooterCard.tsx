import { CheckIcon } from "../shared/icons.tsx";

export interface FooterCardProps {
  /** The membership card's words and link (EV-17); null shows no card. */
  membership: {
    title: string;
    intro: string;
    benefits: readonly string[];
    note: string;
    link: string;
  } | null;
}

/**
 * The end of the list (EV-17): the membership card; when the schedule changed is in Settings
 * (EV-41). The card
 * is neutral (colour means an event's kind, D45): a heading, one line, up to three benefits
 * with grey checks, one outlined button to the pricing plans page, and a small note.
 */
export function FooterCard({ membership }: FooterCardProps) {
  return (
    <footer>
      {membership && (
        <section className="ui-card ui-member" aria-labelledby="ui-member-title">
          <h2 id="ui-member-title">{membership.title}</h2>
          <p>{membership.intro}</p>
          <ul>
            {membership.benefits.map((benefit) => (
              <li key={benefit}>
                <CheckIcon />
                {benefit}
              </li>
            ))}
          </ul>
          <a
            className="ui-btn ui-btn-outline"
            href={membership.link}
            target="_blank"
            rel="noopener"
          >
            See membership plans
          </a>
          <p className="ui-member-note">{membership.note}</p>
        </section>
      )}
    </footer>
  );
}
