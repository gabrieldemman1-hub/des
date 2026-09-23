import { Link } from 'react-router';
import type { WeaponArchetype } from '../../../knowledge/index';
import { AIM_STYLE_NAMES, NO_AIM_STYLE } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';
import { ConfidenceBadge } from './ConfidenceBadge';
import { StatementView } from './StatementView';

/** The main weapon's aim style, its confidence, and (on tap) why the weapon maps to it. */
export function AimStyleSummary({ archetype }: { archetype: WeaponArchetype }) {
  const { aimStyleById } = useKnowledge();
  const style = archetype.aimStyle === null ? undefined : aimStyleById(archetype.aimStyle);
  const name = archetype.aimStyle === null ? NO_AIM_STYLE : (style?.name ?? AIM_STYLE_NAMES[archetype.aimStyle]);
  const question =
    archetype.aimStyle === null ? `Why no aim style for ${archetype.name}?` : `Why ${name.toLowerCase()} for ${archetype.name}?`;
  return (
    <div className="aim-style">
      <p className="aim-style-line">
        <span className="aim-style-label">Aim style</span>
        <strong className="aim-style-name">{name}</strong>
        <ConfidenceBadge level={archetype.mapping.confidence} />
      </p>
      <details className="why">
        <summary>{question}</summary>
        <StatementView statement={archetype.mapping} showBadge={false} />
      </details>
      {style && <Link to={`/learn/styles/${style.id}`}>How to tune for {style.name.toLowerCase()}</Link>}
    </div>
  );
}
