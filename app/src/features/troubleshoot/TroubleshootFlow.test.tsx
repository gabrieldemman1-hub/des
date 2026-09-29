import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { knowledge, type FoundationCheck, type Symptom } from '../../../../knowledge/index';
import { EASING_CAVEAT } from '../../../../knowledge/integrity';
import type { OutputType, Platform } from '../../../../knowledge/schema';
import { checksForProfile } from '../../state/guidance';
import { createKnowledgeApi } from '../../state/knowledge-context';
import { progressKey } from '../../state/progress';
import type { AppData } from '../../state/schema';
import { STORAGE_KEY } from '../../state/storage';
import { sampleData } from '../../test/fixtures';
import { MemoryStorage } from '../../test/memory-storage';
import { renderApp } from '../../test/render';

const real = createKnowledgeApi(knowledge);

const XBOX = { platform: 'xbox', outputType: 'xbox-controller' } as const;
const PC = { platform: 'pc', outputType: 'pc-xinput' } as const;

function storageWith(
  profile: { platform: Platform | null; outputType: OutputType | null },
  progress: AppData['progress'] = {},
): MemoryStorage {
  const data = sampleData({ progress });
  data.profile.platform = profile.platform;
  data.profile.outputType = profile.outputType;
  return new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(data) });
}

function storedProgress(storage: MemoryStorage): AppData['progress'] {
  return (storage.json(STORAGE_KEY) as AppData).progress;
}

function checkById(id: string): FoundationCheck {
  const check = knowledge.foundation.find((c) => c.id === id);
  if (!check) throw new Error(`No setup check ${id}`);
  return check;
}

function symptomById(id: string): Symptom {
  const symptom = knowledge.symptoms.find((s) => s.id === id);
  if (!symptom) throw new Error(`No symptom ${id}`);
  return symptom;
}

/** The titles of the setup checks listed inside `container`, in order. */
function listedChecks(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.checklist-item .checklist-title')).map((p) => p.textContent ?? '');
}

const stage1 = () => screen.getByRole('region', { name: 'Stage 1: Setup check' });
const stage2 = () => screen.getByRole('region', { name: 'Stage 2: What do you feel?' });
const checkItem = (title: string) => screen.getByRole('listitem', { name: title });

describe('Troubleshoot by feel: stage 1, setup check', () => {
  it('lists only the checks that apply on Xbox', () => {
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    expect(screen.getByRole('heading', { level: 1, name: 'Troubleshoot by feel' })).toBeInTheDocument();

    const expected = checksForProfile(knowledge.foundation, XBOX);
    expect(expected.length).toBeLessThan(knowledge.foundation.length);
    expect(listedChecks(stage1())).toEqual(expected.map((c) => c.title));
    expect(listedChecks(stage1())).toContain(checkById('xbox-authentication-controller').title);
    expect(listedChecks(stage1())).not.toContain(checkById('pc-virtual-controller-tools').title);
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`0 of ${expected.length} done`);
    expect(within(stage1()).getByText(/Showing checks for Xbox/)).toBeInTheDocument();
  });

  it('lists only the checks that apply on PC, by output type', () => {
    const { unmount } = renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(PC) });
    const xinput = checksForProfile(knowledge.foundation, PC);
    expect(listedChecks(stage1())).toEqual(xinput.map((c) => c.title));
    expect(listedChecks(stage1())).toContain(checkById('pc-virtual-controller-tools').title);
    expect(listedChecks(stage1())).not.toContain(checkById('xbox-authentication-controller').title);
    // The authentication controller check is only for Xbox or DualSense output on PC.
    expect(listedChecks(stage1())).not.toContain(checkById('pc-authentication-controller').title);
    unmount();

    renderApp({
      path: '/troubleshoot',
      knowledge: real,
      storage: storageWith({ platform: 'pc', outputType: 'pc-dualsense' }),
    });
    expect(listedChecks(stage1())).toContain(checkById('pc-authentication-controller').title);
  });

  it('shows checks for both platforms while the platform isn’t set, and points to the profile', () => {
    renderApp({ path: '/troubleshoot', knowledge: real });
    expect(listedChecks(stage1())).toEqual(knowledge.foundation.map((c) => c.title));
    expect(within(stage1()).getByText(/checks for both platforms are shown/)).toBeInTheDocument();
    expect(within(stage1()).getByRole('link', { name: 'Set your platform in your profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('shows each check’s reason and fix from the knowledge base, with their sources', () => {
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    const firmware = checkById('firmware-current');
    const item = checkItem(firmware.title);
    expect(item).toHaveTextContent(firmware.check);
    expect(item).toHaveTextContent(firmware.why.text);
    expect(item).toHaveTextContent(firmware.fix!.text);
    expect(within(item).getAllByRole('list', { name: 'Sources' }).length).toBeGreaterThanOrEqual(2);
    expect(within(item).getByRole('link', { name: 'Firmware' })).toHaveAttribute('href', '/learn/firmware');
  });

  it('saves a mark under the shared setup-check key and updates the summary', async () => {
    const storage = storageWith(XBOX);
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage });
    const total = checksForProfile(knowledge.foundation, XBOX).length;
    const firmware = checkItem(checkById('firmware-current').title);

    await user.click(within(firmware).getByRole('button', { name: 'Done' }));
    expect(storedProgress(storage)['check:firmware-current']).toBe('done');
    expect(within(firmware).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`1 of ${total} done`);

    const dpi = checkItem(checkById('mouse-dpi-matches').title);
    await user.click(within(dpi).getByRole('button', { name: 'Needs fixing' }));
    expect(storedProgress(storage)['check:mouse-dpi-matches']).toBe('problem');
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`1 of ${total} done · 1 needs fixing`);
    expect(within(stage2()).getByText(/^Best after the setup check/)).toHaveTextContent(
      `you’ve checked 2 of ${total}`,
    );

    // Tapping the active toggle again clears the mark.
    await user.click(within(firmware).getByRole('button', { name: 'Done' }));
    expect(storedProgress(storage)).not.toHaveProperty('check:firmware-current');
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`0 of ${total} done · 1 needs fixing`);
  });

  it('opens “How to fix it” when a check is marked Needs fixing', async () => {
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    const dpi = checkById('mouse-dpi-matches');
    const item = checkItem(dpi.title);
    const fixText = within(item).getByText(dpi.fix!.text);
    expect(fixText).not.toBeVisible();

    await user.click(within(item).getByRole('button', { name: 'Needs fixing' }));
    expect(fixText).toBeVisible();
    expect(fixText.closest('details')).toHaveTextContent('How to fix it');

    await user.click(within(item).getByRole('button', { name: 'Done' }));
    expect(fixText).not.toBeVisible();
  });

  it('shows the fix already open for a check saved as Needs fixing', () => {
    renderApp({
      path: '/troubleshoot',
      knowledge: real,
      storage: storageWith(XBOX, { 'check:mouse-polling-rate': 'problem' }),
    });
    const polling = checkById('mouse-polling-rate');
    expect(within(checkItem(polling.title)).getByText(polling.fix!.text)).toBeVisible();
  });

  it('clears only the setup-check marks, after an in-page confirmation', async () => {
    const storage = storageWith(XBOX, {
      'check:firmware-current': 'done',
      'check:mouse-dpi-matches': 'problem',
      // A check for another platform, and a Build my config item that isn't a setup check.
      'check:pc-virtual-controller-tools': 'done',
      'required:look-sensitivity': 'done',
    });
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage });
    const total = checksForProfile(knowledge.foundation, XBOX).length;
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`1 of ${total} done · 1 needs fixing`);

    const reset = within(stage1()).getByRole('button', { name: 'Clear setup-check marks' });
    await user.click(reset);
    let dialog = screen.getByRole('alertdialog', { name: 'Clear the setup check?' });
    expect(dialog).toHaveTextContent('Build my config');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(storedProgress(storage)['check:firmware-current']).toBe('done');

    await user.click(reset);
    dialog = screen.getByRole('alertdialog', { name: 'Clear the setup check?' });
    await user.click(within(dialog).getByRole('button', { name: 'Clear marks' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(storedProgress(storage)).toEqual({ 'required:look-sensitivity': 'done' });
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`0 of ${total} done`);

    // Nothing left to clear: the button stays (focus returns to it) but does nothing.
    expect(reset).toHaveFocus();
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    await user.click(reset);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the Destiny 2 settings check as Done once every required setting is Done in Build my config', async () => {
    const required = knowledge.game.requiredSettings.map((s) => progressKey.requiredSetting(s.name));
    const allDone: AppData['progress'] = Object.fromEntries(required.map((k) => [k, 'done']));
    const storage = storageWith(XBOX, allDone);
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage });
    const total = checksForProfile(knowledge.foundation, XBOX).length;

    const item = checkItem(checkById('destiny2-required-settings').title);
    expect(within(item).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(item).toHaveTextContent('Shown as Done because every Destiny 2 setting is marked Done in Build my config.');
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`1 of ${total} done`);
    // Nothing is saved for it: it follows the settings.
    expect(storedProgress(storage)).not.toHaveProperty('check:destiny2-required-settings');

    // Tapping it still sets its own mark.
    await user.click(within(item).getByRole('button', { name: 'Needs fixing' }));
    expect(storedProgress(storage)['check:destiny2-required-settings']).toBe('problem');
    expect(within(item).getByRole('button', { name: 'Needs fixing' })).toHaveAttribute('aria-pressed', 'true');
    expect(item).not.toHaveTextContent('Shown as Done');
    expect(within(stage1()).getByRole('status')).toHaveTextContent(`0 of ${total} done · 1 needs fixing`);
  });

  it('shows the Destiny 2 settings check as Needs fixing when a required setting needs fixing', () => {
    const storage = storageWith(XBOX, { [progressKey.requiredSetting('Look Sensitivity')]: 'problem' });
    renderApp({ path: '/troubleshoot', knowledge: real, storage });
    const item = checkItem(checkById('destiny2-required-settings').title);
    expect(within(item).getByRole('button', { name: 'Needs fixing' })).toHaveAttribute('aria-pressed', 'true');
    // Like a mark the player set, it opens the fix.
    expect(within(item).getByText(checkById('destiny2-required-settings').fix!.text)).toBeVisible();
  });

  it('tags the per-Config checks, and says once what that means', () => {
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    for (const id of ['mouse-dpi-matches', 'smart-translator-current', 'light-notifications', 'clean-sensitivity-test']) {
      expect(within(checkItem(checkById(id).title)).getByText('Per Config', { selector: '.tag' }), id).toBeInTheDocument();
    }
    for (const id of ['firmware-current', 'mouse-polling-rate', 'destiny2-required-settings']) {
      expect(checkItem(checkById(id).title), id).not.toHaveTextContent('Per Config');
    }
    const hint = within(stage1()).getByText(/marks a check to repeat in every Config you use/);
    expect(hint).toHaveClass('hint');
    expect(within(stage1()).getAllByText(/every Config you use/)).toHaveLength(1);
  });

  it('repeats a marked check’s state as a chip in its title row, with a mark and not the accent fill', async () => {
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    const item = checkItem(checkById('firmware-current').title);
    const chip = () => item.querySelector('.checklist-head .status-chip');
    expect(chip()).toBeNull();

    await user.click(within(item).getByRole('button', { name: 'Done' }));
    expect(chip()).toHaveTextContent('Done');
    expect(chip()).toHaveClass('is-done');
    expect(chip()!.querySelector('svg.status-mark')).not.toBeNull();
    const done = within(item).getByRole('button', { name: 'Done' });
    expect(done).toHaveClass('status-toggle', 'is-done');
    expect(done).not.toHaveClass('primary');
    // The toggles' accessible names stay the two words: the mark is decoration.
    expect(within(item).getByRole('group', { name: 'Status' })).toHaveTextContent(/^DoneNeeds fixing$/);

    await user.click(within(item).getByRole('button', { name: 'Needs fixing' }));
    expect(chip()).toHaveTextContent('Needs fixing');
    expect(chip()).toHaveClass('is-problem');
    expect(within(item).getByRole('button', { name: 'Needs fixing' })).toHaveClass('is-problem');
  });

  it('gives the Done and Needs fixing buttons the check’s title as their description', () => {
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    const title = checkById('firmware-current').title;
    const item = checkItem(title);
    expect(within(item).getByRole('button', { name: 'Done' })).toHaveAccessibleDescription(title);
    expect(within(item).getByRole('button', { name: 'Needs fixing' })).toHaveAccessibleDescription(title);
  });

  it('puts the empty-state headings under the stage headings', () => {
    renderApp({ path: '/troubleshoot' });
    expect(screen.getByRole('heading', { level: 3, name: 'No setup checks yet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'No symptoms yet' })).toBeInTheDocument();
  });
});

describe('Troubleshoot by feel: stage 2, symptoms', () => {
  const GAPS = ['floaty', 'overshooting', 'mushy'];

  it('lists every symptom, tagging the ones with no sourced answer', () => {
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    expect(knowledge.symptoms).toHaveLength(10);
    expect(knowledge.symptoms.filter((s) => s.mapping.confidence === 'gap').map((s) => s.id)).toEqual(GAPS);

    const links = within(stage2()).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(knowledge.symptoms.map((s) => `/troubleshoot/${s.id}`));
    for (const symptom of knowledge.symptoms) {
      const label = new RegExp(`^${symptom.label.replace(/[()]/g, '\\$&')}`);
      const link = within(stage2()).getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', `/troubleshoot/${symptom.id}`);
      if (GAPS.includes(symptom.id)) expect(link).toHaveTextContent('No sourced answer yet');
      else expect(link).not.toHaveTextContent('No sourced answer yet');
    }
  });

  it('nudges toward finishing the setup check, without blocking', () => {
    const checks = checksForProfile(knowledge.foundation, XBOX);
    const progress: AppData['progress'] = Object.fromEntries(checks.map((c) => [`check:${c.id}`, 'done']));
    const { unmount } = renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX, progress) });
    expect(within(stage2()).getByText('Setup check done. Pick the feel that fits best.')).toBeInTheDocument();
    unmount();

    progress['check:firmware-current'] = 'problem';
    renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX, progress) });
    expect(within(stage2()).getByText(/^Every setup check is marked\. Fix the ones marked Needs fixing/)).toBeInTheDocument();
    expect(within(stage2()).getAllByRole('link')).toHaveLength(knowledge.symptoms.length);
  });

  it('jumps to stage 2', async () => {
    const { user } = renderApp({ path: '/troubleshoot', knowledge: real, storage: storageWith(XBOX) });
    await user.click(screen.getByRole('button', { name: 'Skip to stage 2' }));
    expect(within(stage2()).getByRole('heading', { level: 2 })).toHaveFocus();
  });

  it('points “a lag when I first start moving” to Easing, with the Easing caveat and one change', async () => {
    const symptom = symptomById('slow-start');
    const { user } = renderApp({ path: '/troubleshoot/slow-start', knowledge: real, storage: storageWith(XBOX) });
    expect(screen.getByRole('heading', { level: 1, name: symptom.label })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Troubleshoot by feel/ })).toHaveAttribute('href', '/troubleshoot');

    // Both statements carry the Easing caveat, so the page says it once under the title, with
    // what Reasoned means; the cards don't repeat either.
    expect(screen.getByRole('note')).toHaveTextContent(`Caveat: ${EASING_CAVEAT}`);
    expect(screen.getAllByText(/official wording is ambiguous/)).toHaveLength(1);
    expect(screen.getByText('Worked out from XIM’s definitions, not stated by a source.', { exact: false })).toHaveClass(
      'confidence-meaning',
    );

    const points = screen.getByRole('region', { name: 'What it points to' });
    expect(points).toHaveTextContent(symptom.mapping.text);
    expect(points).not.toHaveTextContent(EASING_CAVEAT);
    expect(points).toHaveTextContent('Reasoned');
    expect(within(points).getByRole('list', { name: 'Sources' })).toBeInTheDocument();

    const change = screen.getByRole('region', { name: 'Try this one change' });
    expect(change).toHaveTextContent(symptom.suggestedChange!.text);
    expect(change).not.toHaveTextContent(EASING_CAVEAT);
    // Its quotes are the ones "What it points to" shows, so it refers up instead of repeating them.
    expect(within(change).queryByRole('blockquote')).toBeNull();
    expect(within(change).getAllByText(/^Quoted above:/).length).toBeGreaterThan(0);

    expect(screen.getByRole('region', { name: 'One change at a time' })).toHaveTextContent(knowledge.guardrail.text);
    expect(screen.queryByRole('region', { name: 'No sourced answer yet' })).not.toBeInTheDocument();

    const next = screen.getByRole('navigation', { name: 'Next steps' });
    expect(within(next).getByRole('link', { name: 'Tune my config' })).toHaveAttribute('href', '/tune');
    expect(within(next).getByRole('link', { name: 'All symptoms' })).toHaveAttribute('href', '/troubleshoot');

    const easing = within(points).getByRole('link', { name: 'Easing' });
    expect(easing).toHaveAttribute('href', '/learn/easing');
    await user.click(easing);
    expect(screen.getByRole('heading', { level: 1, name: 'Easing' })).toBeInTheDocument();
  });

  it('shows a gap honestly: no guess, no change to try, and the setup check first', () => {
    const symptom = symptomById('floaty');
    renderApp({ path: '/troubleshoot/floaty', knowledge: real, storage: storageWith(XBOX) });
    expect(screen.getByRole('heading', { level: 1, name: symptom.label })).toBeInTheDocument();

    const gap = screen.getByRole('region', { name: 'No sourced answer yet' });
    expect(gap).toHaveTextContent(symptom.mapping.text);
    expect(within(gap).getByText('Gap')).toBeInTheDocument();
    expect(within(gap).getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/learn');
    expect(screen.queryByRole('region', { name: 'Try this one change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What it points to' })).not.toBeInTheDocument();

    const first = screen.getByRole('region', { name: 'Check these first' });
    const expected = checksForProfile(
      knowledge.foundation.filter((c) => symptom.checkIds.includes(c.id)),
      XBOX,
    );
    expect(listedChecks(first)).toEqual(expected.map((c) => c.title));
    expect(listedChecks(first)).not.toContain(checkById('pc-virtual-controller-tools').title);
    expect(screen.getByRole('region', { name: 'One change at a time' })).toHaveTextContent(knowledge.guardrail.text);
  });

  it('lists only the setup checks a symptom names', () => {
    renderApp({ path: '/troubleshoot/capped-turns', knowledge: real, storage: storageWith(XBOX) });
    const first = screen.getByRole('region', { name: 'Check these first' });
    expect(listedChecks(first)).toEqual([
      checkById('destiny2-required-settings').title,
      checkById('light-notifications').title,
    ]);
  });

  it('shares setup-check marks between a symptom and stage 1', async () => {
    const storage = storageWith(XBOX);
    const { user } = renderApp({ path: '/troubleshoot/floaty', knowledge: real, storage });
    const title = checkById('firmware-current').title;
    await user.click(within(checkItem(title)).getByRole('button', { name: 'Done' }));
    expect(storedProgress(storage)['check:firmware-current']).toBe('done');

    const next = screen.getByRole('navigation', { name: 'Next steps' });
    await user.click(within(next).getByRole('link', { name: 'All symptoms' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Troubleshoot by feel' })).toBeInTheDocument();
    expect(within(checkItem(title)).getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows XIM Central notes about the symptom', () => {
    const notes = knowledge.expertNotes.filter((n) => n.symptomIds.includes('jitter'));
    expect(notes.length).toBeGreaterThan(0);
    renderApp({ path: '/troubleshoot/jitter', knowledge: real, storage: storageWith(XBOX) });
    const region = screen.getByRole('region', { name: 'XIM Central notes' });
    for (const note of notes) expect(region).toHaveTextContent(note.statement.text);
  });

  it('leaves out XIM Central notes when there are none', () => {
    renderApp({ path: '/troubleshoot/slow-start', knowledge: real, storage: storageWith(XBOX) });
    expect(screen.queryByRole('region', { name: 'XIM Central notes' })).not.toBeInTheDocument();
  });

  it('treats an unknown symptom as not found', async () => {
    const { user } = renderApp({ path: '/troubleshoot/not-a-symptom', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Symptom not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'See all symptoms' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Troubleshoot by feel' })).toBeInTheDocument();
  });

  it('treats a deeper address as not found', () => {
    renderApp({ path: '/troubleshoot/jitter/extra', knowledge: real });
    expect(screen.getByRole('heading', { level: 1, name: 'Symptom not found' })).toBeInTheDocument();
  });

  it('says so when the knowledge base has no setup checks or symptoms', () => {
    renderApp({ path: '/troubleshoot' });
    expect(screen.getByRole('heading', { level: 1, name: 'Troubleshoot by feel' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No setup checks yet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No symptoms yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip to stage 2' })).not.toBeInTheDocument();
  });
});
