# Research notes: Play (Flow E), Crucible coaching

**Date:** 2026-10-06 · pages fetched that day

**Why:** the user asked for Dialed to coach their Destiny 2 PvP: frameworks to work through
while playing, and the foundational mindset of playing like a strong player. The worked
example was Javelin-4 with a 120 RPM hand cannon and a slug shotgun, with the goal of
establishing map control (reaching the key spots), holding a left-hand peek so the minimum of
the body is exposed, and challenging only with the advantage. The user chose a detailed Play
section inside the app.

**Method:** the frameworks and principles are Dialed's own synthesis of competitive-shooter
fundamentals, written against the user's example. Web research was used only for the parts that
can be checked: the map's callouts and character, the current Trials format, and the weapon
facts. Every Play item carries a basis tag instead of a §8 confidence label (see the decision
below).

> **Decisions (2026-10-06):**
> - Play is the one part of Dialed that is not held to the §8 source whitelist, because no XIM
>   source speaks to how to play. It does not use the Official, Expert, Contested or Reasoned
>   labels. Each item names its basis instead: *fundamental* (holds in every competitive
>   shooter), *Destiny 2* (a game mechanic or number; a patch can change it), *map* (community
>   callout maps; fireteams differ), or *Dialed* (Dialed's own reasoning).
> - Play never invents a number. Where a value depends on the current sandbox (a slug's
>   one-shot range, a hand cannon's falloff), the framework says how to measure it in a private
>   match instead.
> - Play content has no `citations` arrays, so `npm run verify:citations` has nothing to fetch
>   for it. The sources below are recorded here, not in the app.
> - The death tally lives under its own storage key (`dialed:v1:play-session`), outside the
>   backup, because it is scratch data for one session.
> - Assumed mode: 3v3 round-based play (Trials of Osiris, Competitive). The user has not yet
>   confirmed the mode, their maps beyond Javelin-4, or their level.

---

## 1. Javelin-4

| Claim | Source | Status |
|---|---|---|
| Set in the Warsat Launch Facility on Io; launched with the base game; supports Clash, Control, Supremacy and Survival | [Javelin-4, Destiny 2 Wiki](https://d2.destinygamewiki.com/wiki/Javelin-4) | Confirmed (page read) |
| 13 named areas: Fuel and Pad (team spawns), Rocket (centre, "the focal point of the entire map. In most cases, the most intense firefights happen here"), Inner Ring, Station, Stairs, Generators (interior), Outer Ring, Deck, Center, Rockwall, Pipes, Glass (exterior) | same | Confirmed (page read) |
| Station holds point B in Control and is "a death trap if players do not know how to defend it" | same | Confirmed (page read) |
| Generators: "a relatively large interior zone providing solid cover and good angles for snipers looking to shoot towards Rocket and Outer Ring"; Glass: "great flanking routes and good angles for snipers looking to make picks at Fuel"; Fuel: "an interior area on one side that offers great cover options" | [Sportskeeda Trials map guide: Javelin-4](https://www.sportskeeda.com/esports/destiny-2-trials-osiris-map-guide-javelin-4-january-28th) (via search summary; the page itself returned 403) | **Not verified against the page** |
| Trials spawns "one on the Generators and the other on Fuel"; "small, close-range map that encourages Shotgun rushing" | Search summary of Trials guides (boosting-ground.com, immortalboost.com) | **Not verified**; contradicts the wiki's Fuel/Pad spawns, so the app says the guides disagree |
| "a map with many open areas and a window for guardians to take long-range fights" | Search summary | **Not verified**; kept as the other side of the disagreement |

The Steam Community callout guide (id 1888977410) returned 429, and gameplay.tips showed only a
callout image with no text. Ascendant Nomad's Javelin-4 Trials thread on X was found by title
only and could not be read.

**How the app uses it:** the callouts and their one-line descriptions are tagged *map*. The
three spots to hold, the phases and the "confirm in a private match" checklist are Dialed's
reasoning (tagged *Dialed*) from those descriptions plus the user's loadout, and the card says
so. The spawn disagreement is stated on the card.

## 2. Trials of Osiris format (for the clock and ammo notes)

| Claim | Source | Status |
|---|---|---|
| 3v3 Elimination, first to five rounds; 90-second rounds | Search summary (destinypedia, thegamer, skycoach) | Not verified against a page; the app does not state the numbers |
| Special ammo on a schedule per round, heavy every four rounds, unused ammo does not carry over | Search summary | Not verified; the app says ammo rules change between seasons and to learn the current one |
| The Edge of Fate (update 9.0.0.1) reworked rewards, matchmaking and progression; the Lighthouse opens at seven wins regardless of losses | Search summary | Not verified; not used in the app |
| Renegades: Trials every Friday when Iron Banner is not on; special and heavy kill points reduced | Search summary | Not verified; not used in the app |

The TWID of 2026-05-29 on bungie.net could not be read (the page needs JavaScript).

## 3. Weapon facts

| Claim | Source | Status |
|---|---|---|
| 120 RPM hand cannon: 2 crits + 1 body, optimal TTK 1.00 s, body-shot TTK 1.50 s | [Blueberries.gg TTK chart](https://www.blueberries.gg/weapons/destiny-2-ttk/), "Updated as of Season of Defiance (S20)" | Confirmed on the page, but the page is from 2023 |
| 140 RPM: 3 crits, 0.87 s; 180 RPM: 2 crits + 2 body, 1.00 s | same | Confirmed on the page; not used in the app |
| Chaperone one-shots at about 12 m; Heritage can reach 100 range with Slideshot and range perks | Search summary (thegamer) | Not verified; the app gives no slug range and says to pace it |
| Legendary slugs one-shot on a headshot only | General knowledge of the sandbox | **Not sourced**; stated in the app as *Destiny 2* with "confirm in the current sandbox" |

**How the app uses it:** the loadout plan states the 120's three-shot, two-crit kill and the
slug's one-projectile, headshot-only one-shot, both tagged *Destiny 2*. It states no range
numbers and no damage numbers. The combos (slug body then one tap, chip then slug) are given
as things to test in a private match, not as facts.

## 4. The left-hand peek

The user's goal names a left-hand peek. Whether one peek side shows less of the player model in
Destiny 2 depends on where the first-person camera sits relative to the hitbox, and no source
read for this note states it. The app therefore defines the left-hand peek by what it reliably
gives (cover on the left, a rehearsed one-strafe step back) and tells the user how to test the
exposure question with a friend in a private match. This is tagged *Dialed*.

## 5. Fundamentals

The principles (advantage before aim, information first, angles not places, minimum exposure,
trade or don't fight, disengaging is winning, patience and the clock, control what you control,
play the same round twice) are standard competitive-shooter coaching, tagged *fundamental*.
A search for Destiny 2 PvP fundamentals (destinytracker.com, gamesradar.com) returned the same
themes in general terms (peek and retreat, know the map's angles, off-angles and flanks, the
"two-second rule" for not camping an angle, short callouts). No page was cited for them, because
the app's wording is its own.

## 6. Open questions for the user

- Mode and team size (Trials, Competitive, 6v6).
- The other maps they see most, for more map cards.
- Their level and the deaths that cost them most, to order the frameworks.
- Whether they want current-sandbox numbers researched and dated, or the "measure it yourself"
  approach kept.
