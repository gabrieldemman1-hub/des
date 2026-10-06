import { Link, useParams } from 'react-router';
import type { PlayCallout } from '../../../../knowledge/index';
import { Screen } from '../../components/Screen';
import { NotFoundScreen } from '../../screens/NotFoundScreen';
import { PLAY_CALLOUT_KIND_LABELS } from '../../content/labels';
import { useKnowledge } from '../../state/knowledge-context';
import { BasisTag, NoteLine } from './BasisTag';
import { playPath } from './paths';
import { Section } from './Section';

const KIND_ORDER: PlayCallout['kind'][] = ['spawn', 'centre', 'interior', 'exterior'];

/** One map card: what it plays like, its callouts, the spots to hold, the plan by phase, and what to confirm. */
export function MapScreen() {
  const { mapId } = useParams();
  const { playMapById, playLoadoutPlanById } = useKnowledge();
  const map = mapId ? playMapById(mapId) : undefined;
  if (!map) return <NotFoundScreen />;

  const calloutName = (id: string) => map.callouts.find((c) => c.id === id)?.name ?? id;
  const groups = KIND_ORDER.map((kind) => ({ kind, callouts: map.callouts.filter((c) => c.kind === kind) })).filter(
    (g) => g.callouts.length > 0,
  );
  const plans = map.loadoutPlanIds.flatMap((id) => {
    const plan = playLoadoutPlanById(id);
    return plan ? [plan] : [];
  });

  return (
    <Screen
      title={map.name}
      documentTitle={`${map.name} map card`}
      back={{ to: playPath.index, label: 'Play' }}
      intro={
        <>
          <p className="eyebrow">Map card</p>
          <p className="lede">{map.summary}</p>
        </>
      }
    >
      {map.character.length > 0 && (
        <Section title="What it plays like">
          <ul className="statement-list">
            {map.character.map((note) => (
              <li className="card" key={note.text}>
                <NoteLine note={note} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Callouts">
        {groups.map(({ kind, callouts }) => (
          <div className="card" key={kind}>
            <h3 className="play-callout-kind">{PLAY_CALLOUT_KIND_LABELS[kind]}</h3>
            <dl className="play-callouts">
              {callouts.map((callout) => (
                <div className="play-callout" key={callout.id}>
                  <dt>
                    {callout.name} <BasisTag basis={callout.basis} />
                  </dt>
                  <dd>{callout.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Section>

      {map.spots.length > 0 && (
        <Section title="Spots to hold" hint="Each spot names the lane it watches and the lanes that watch it. If the second is longer, it isn’t a spot.">
          <ul className="statement-list">
            {map.spots.map((spot) => (
              <li className="card" key={spot.id}>
                <p className="lever-head">
                  <span>{spot.name}</span>
                  <span className="tag">
                    {spot.spawnCalloutId ? `${calloutName(spot.spawnCalloutId)} spawn` : 'Either spawn'}
                  </span>
                </p>
                <dl className="play-fields">
                  <dt>Hold from</dt>
                  <dd>{spot.holdFrom}</dd>
                  <dt>Peek</dt>
                  <dd>{spot.peek}</dd>
                  <dt>Watches</dt>
                  <dd>{spot.watches}</dd>
                  <dt>Watched by</dt>
                  <dd>{spot.watchedBy}</dd>
                  <dt>Why</dt>
                  <dd>
                    {spot.why} <BasisTag basis={spot.basis} />
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {map.phases.length > 0 && (
        <Section title="The plan">
          <ul className="statement-list">
            {map.phases.map((phase) => (
              <li className="card" key={phase.id}>
                <h3 className="play-callout-kind">{phase.title}</h3>
                <ol className="prose play-list">
                  {phase.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {map.verify.length > 0 && (
        <Section title="Confirm in a private match" hint="The card is a starting plan. These checks turn it into yours.">
          <ol className="card prose play-list">
            {map.verify.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </Section>
      )}

      {plans.length > 0 && (
        <Section title="Loadout plans for this map">
          <ul className="related-links">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link to={playPath.loadoutPlan(plan.id)}>{plan.name}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Screen>
  );
}
