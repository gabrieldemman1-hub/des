import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import type { AimStyleId, WeaponArchetype, WeaponSlot } from '../../../knowledge/index';
import { AimStyleSummary } from '../components/AimStyleSummary';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WeaponListMissing } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { AIM_STYLE_NAMES, NO_AIM_STYLE } from '../content/labels';
import { useData } from '../state/data-context';
import { useKnowledge } from '../state/knowledge-context';
import {
  SLOTS,
  draftFromLoadout,
  emptyDraft,
  setDraftMainSlot,
  setDraftName,
  setDraftWeapon,
  validateDraft,
  type LoadoutDraft,
} from '../state/loadouts';
import { MAX_LOADOUT_NAME_LENGTH, type Loadout } from '../state/schema';
import { useCloseEditor } from './loadout-navigation';

/** Option groups in the weapon pickers; weapons with no aim style (e.g. swords) come last. */
const STYLE_ORDER: (AimStyleId | null)[] = ['tracking', 'snap', 'precision-hold', null];

function useArchetypeGroups() {
  const { kb, aimStyleById } = useKnowledge();
  return STYLE_ORDER.map((style) => ({
    key: style ?? 'none',
    label: style === null ? NO_AIM_STYLE : (aimStyleById(style)?.name ?? AIM_STYLE_NAMES[style]),
    archetypes: kb.weapons.archetypes.filter((a) => a.aimStyle === style),
  })).filter((group) => group.archetypes.length > 0);
}

function LoadoutForm({ loadout }: { loadout?: Loadout }) {
  const { archetypeById, slotName } = useKnowledge();
  const { saveLoadout, deleteLoadout } = useData();
  const { close, onLinkClick } = useCloseEditor();
  const groups = useArchetypeGroups();

  const [draft, setDraft] = useState<LoadoutDraft>(() => (loadout ? draftFromLoadout(loadout) : emptyDraft()));
  const [submitted, setSubmitted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const ids = { name: useId(), nameError: useId(), weaponsError: useId(), mainError: useId(), mainHint: useId() };
  const nameInput = useRef<HTMLInputElement>(null);
  const firstSelect = useRef<HTMLSelectElement>(null);
  const mainGroup = useRef<HTMLFieldSetElement>(null);

  const validation = validateDraft(draft);
  const errors = submitted && !validation.ok ? validation.errors : {};

  const weaponName = (id: string | null): string =>
    id === null ? 'Empty slot' : (archetypeById(id)?.name ?? `Unknown weapon (${id})`);

  const mainArchetype: WeaponArchetype | undefined =
    draft.mainSlot && draft.weapons[draft.mainSlot] ? archetypeById(draft.weapons[draft.mainSlot] ?? '') : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const result = saveLoadout(draft, loadout?.id);
    if (result.ok) {
      close(`Saved “${result.loadout.name}”.`);
      return;
    }
    if (result.errors.name) nameInput.current?.focus();
    else if (result.errors.weapons) firstSelect.current?.focus();
    else if (result.errors.mainSlot) mainGroup.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  };

  const onDelete = () => {
    if (!loadout) return;
    setConfirmingDelete(false);
    deleteLoadout(loadout.id);
    close(`Deleted “${loadout.name}”.`);
  };

  return (
    <form className="form" noValidate onSubmit={onSubmit} aria-label={loadout ? 'Edit loadout' : 'New loadout'}>
      <div className="field">
        <label htmlFor={ids.name}>Name</label>
        <input
          ref={nameInput}
          id={ids.name}
          type="text"
          autoComplete="off"
          placeholder="e.g. Pulse + shotgun"
          maxLength={MAX_LOADOUT_NAME_LENGTH}
          value={draft.name}
          onChange={(e) => setDraft((d) => setDraftName(d, e.target.value))}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? ids.nameError : undefined}
        />
        {errors.name && (
          <p className="error" id={ids.nameError}>
            {errors.name}
          </p>
        )}
      </div>

      <fieldset className="field" aria-describedby={errors.weapons ? ids.weaponsError : undefined}>
        <legend>Weapons</legend>
        <p className="hint">Pick a weapon type for each slot you use. Leave a slot empty if it doesn’t matter.</p>
        {SLOTS.map((slot, i) => {
          const selected = draft.weapons[slot];
          const unknown = selected !== null && !archetypeById(selected);
          const selectId = `${ids.name}-${slot}`;
          return (
            <div className="field slot-field" key={slot}>
              <label htmlFor={selectId}>{slotName(slot)}</label>
              <select
                ref={i === 0 ? firstSelect : undefined}
                id={selectId}
                value={selected ?? ''}
                onChange={(e) => setDraft((d) => setDraftWeapon(d, slot, e.target.value === '' ? null : e.target.value))}
                aria-invalid={errors.weapons ? true : undefined}
              >
                <option value="">Empty</option>
                {unknown && <option value={selected}>{weaponName(selected)}</option>}
                {groups.map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.archetypes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          );
        })}
        {errors.weapons && (
          <p className="error" id={ids.weaponsError}>
            {errors.weapons}
          </p>
        )}
      </fieldset>

      <fieldset
        ref={mainGroup}
        className="field"
        aria-describedby={errors.mainSlot ? `${ids.mainHint} ${ids.mainError}` : ids.mainHint}
      >
        <legend>Main weapon</legend>
        <p className="hint" id={ids.mainHint}>
          This loadout’s Config is tuned toward its main weapon’s aim style. Only a filled slot can be the main one.
        </p>
        <div className="choice-list">
          {SLOTS.map((slot: WeaponSlot) => {
            const filled = draft.weapons[slot] !== null;
            return (
              <label className={`choice${filled ? '' : ' is-disabled'}`} key={slot}>
                <input
                  type="radio"
                  name={`${ids.name}-main`}
                  value={slot}
                  checked={draft.mainSlot === slot}
                  disabled={!filled}
                  onChange={() => setDraft((d) => setDraftMainSlot(d, slot))}
                />
                <span className="choice-text">
                  <span className="choice-title">{slotName(slot)}</span>
                  <span className="choice-sub">{weaponName(draft.weapons[slot])}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.mainSlot && (
          <p className="error" id={ids.mainError}>
            {errors.mainSlot}
          </p>
        )}
      </fieldset>

      {mainArchetype && (
        <div className="card main-preview">
          <p className="main-preview-title">
            Main weapon: <strong>{mainArchetype.name}</strong>
          </p>
          <AimStyleSummary archetype={mainArchetype} />
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button primary">
          {loadout ? 'Save changes' : 'Save loadout'}
        </button>
        <Link className="button secondary" to="/loadouts" onClick={onLinkClick}>
          Cancel
        </Link>
      </div>

      {loadout && (
        <div className="danger-zone">
          <button type="button" className="button danger" onClick={() => setConfirmingDelete(true)}>
            Delete loadout
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete “${loadout?.name ?? ''}”?`}
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p>This removes the loadout from this phone. It can’t be undone.</p>
      </ConfirmDialog>
    </form>
  );
}

export function LoadoutEditorScreen() {
  const { loadoutId } = useParams();
  const { data } = useData();
  const { kb } = useKnowledge();
  const { onLinkClick } = useCloseEditor();
  const back = { to: '/loadouts', label: 'Loadouts', onClick: onLinkClick };

  if (loadoutId === undefined) {
    return (
      <Screen title="New loadout" back={back}>
        {kb.weapons.archetypes.length > 0 ? <LoadoutForm key="new" /> : <WeaponListMissing />}
      </Screen>
    );
  }

  const loadout = data.loadouts.find((l) => l.id === loadoutId);
  if (!loadout) {
    return (
      <Screen title="Loadout not found" back={back}>
        <p>This loadout doesn’t exist on this phone. It may have been deleted.</p>
      </Screen>
    );
  }

  return (
    <Screen title="Edit loadout" back={back}>
      <LoadoutForm key={loadout.id} loadout={loadout} />
    </Screen>
  );
}
