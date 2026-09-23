import type { WeaponArchetype } from '../../../knowledge/index';
import { AIM_STYLE_NAMES } from '../content/labels';
import { useKnowledge } from '../state/knowledge-context';
import { ConfidenceBadge } from './ConfidenceBadge';
import { StatementView } from './StatementView';

/** The main weapon's aim style, its confidence, and (on tap) why the weapon maps to it. */
export function AimStyleSummary({ archetype }: { archetype: WeaponArchetype }) {
  const { aimStyleById } = useKnowledge();
  const style = aimStyleById(archetype.aimStyle);
  const name = style?.name ?? AIM_STYLE_NAMES[archetype.aimStyle];
  return (
    <div className="aim-style">
      <p className="aim-style-line">
        <span className="aim-style-label">Aim style</span>
        <strong className="aim-style-name">{name}</strong>
        <ConfidenceBadge level={archetype.mapping.confidence} />
      </p>
      <details className="why">
        <summary>
          Why {name.toLowerCase()} for {archetype.name}?
        </summary>
        <StatementView statement={archetype.mapping} showBadge={false} />
      </details>
    </div>
  );
}
