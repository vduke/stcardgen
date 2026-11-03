# Pre-roll steering — design brief (draft for review)

Status: implemented through phase 3 (0.14.0). All steers ship: VIBE/WARMTH mask cells, SEXUALITY,
tiered EXPERIENCE with orientation filtering, theme pickers for characters and worlds, and persona
pickers in Bulk and Create Persona. Phase 5 (presets, weights, per-image overrides) remains.

## Implemented so far (0.13.0)

- A steered channel is not drawn: `rollPreRoll({ steer: { THEME: entry } })` forces the entry, and a
  mismatched steer value falls back to a normal draw.
- CHARACTER THEME and WORLD THEME tables, 16 entries each, with prompts that treat theme as pressure
  and atmosphere rather than a genre label.
- Review/Fix/Enhance/quality passes receive the block and are told to keep it where details leave a
  channel open.
- The pre-roll panel already round-trips label lines; the new pickers will write the same lines.

## Problem

Batches converge unless something varies them. The pre-roll solves that by drawing material before
the model sees the image. But it currently competes with the user: a batch of "sociable party girls"
can come back quiet and reserved because the roll is treated as binding, and every channel is rolled
even when the user already answered it. Users also get batch-wide sameness in Y2K fashion and
boyfriend-shaped experience lists regardless of the card's orientation.

## Goals

- A batch reads as the brief. Six "party girls" all read as party girls.
- Cards still differ from each other inside the brief.
- The user can steer broad groups (energy, warmth, sexuality, experience tier) without writing prose.
- Rolled material is visible, editable, and never overwrites a decision the user made.

## Non-goals (v1)

- Per-image steering inside a bulk batch.
- Saved named presets ("party girls", "quiet town").
- Weighted draws.
- Character/male steering parity (phase 4, not 1–3).
- Any change to the world generator.

## Precedence contract

Highest to lowest:

1. Structured pick (dropdown).
2. User's free-text details.
3. Rolled value.
4. Model's own invention.

A channel is in one of three states:

- **Settled** — a higher layer answered it. The rolled value is ignored for that channel; the card is
  written from the higher layer.
- **Tinted** — the higher layer narrows it without answering it (e.g. "from a cold town" tints SETTING
  but does not name a setting). The roll is bent to fit.
- **Open** — nothing above speaks to it. The roll is used as given.

The block says this in as many words, and every channel is individually skippable.

## Vocabulary

- **Energy** (VIBE): Shy · Reserved · Steady · Outgoing · Big personality. How hard she reaches for
  people. Shy wants in and freezes; Reserved is quiet by choice; Steady is unperformed; Outgoing
  initiates; Big personality takes the room.
- **Warmth** (WARMTH): Sweet · Neutral · Sharp. What she does with the people she reaches. Sweet
  gives, Sharp withholds, Neutral neither.
- Together, Energy × Warmth selects a MASK TEMPERAMENT cell (15 cells, 2–3 masks each). The pair is
  also written into the block so the register survives edits.
- **Sexuality** (SEXUALITY): Default (by gender) · Straight→Heterosexual · Bisexual · Lesbian · Gay.
  "Default" resolves to Bisexual for a female card, Heterosexual for a male card, Bisexual for
  non-binary/unspecified. Explicit pick always wins.
- **Experience** (SOURCE OF EXPERIENCE): Virgin · Some experience · Experienced · Hedonist. Each
  tier is its own act list. Orientation filtering applies (below).

## Orientation × experience

An act pool that says "two boyfriends" must not land on a Lesbian card or a male card. V1 approach:

- Act tiers are written partner-neutral ("a partner", "partners") as the base.
- Each orientation has a small overlay: replace or exempt entries that name a partner gender.
  Heterosexual women / gay men get cock-shaped acts; Lesbian women / gay men get clit-shaped acts;
  Bisexual gets either and both.
- A card's orientation comes from the settled/rolled SEXUALITY, so filtering happens after that
  resolves, before SOURCE is drawn.
- Virgin tier needs no filtering.

## Steered draw rules

- `steer` is `{ VIBE, WARMTH, SEXUALITY, SOURCE }`, values are the option keys above.
- VIBE/WARMTH force the line and narrow the mask pool to the matching cell. Missing axis: union of
  that axis's cells. Cell exhausted: fall back to the same Energy, then the full table.
- SEXUALITY forces the line; untouched resolves to the gender default (not a random orientation).
- SOURCE draws only within the selected tier after orientation filtering.
- Avoid lists still apply per channel inside the narrowed pool.

## UX

- Controls: Energy and Warmth selects under a "Personality" label; Sexuality and Experience selects
  below. All include Any/Default. Batch keeps selections between runs; Create Persona resets to
  Any/Default after generating.
- Existing pre-roll block shows the picks as `VIBE:`, `WARMTH:`, `SEXUALITY:` lines; the editor can
  edit or clear them.
- Regenerate reuses the block, so picks only re-apply when the block is cleared. This is stated next
  to the controls.
- Pre-roll off hides the controls.

## Data

- `draft.preRollSteer` persists with the draft and is passed to the draw.
- Block edit/clear is the override; no second source of truth.
- Old drafts without the new lines parse as before; missing VIBE/WARMTH behave as Any.

## Tests

- Every mask appears in exactly one Energy/Warmth cell; each cell has >= 2 masks.
- A pick cannot leak outside its cell; missing axis unions only its own axis.
- Sexuality default resolution by gender; explicit pick wins.
- Orientation filtering never returns an incompatible act.
- Experience tiers never return an act from another tier.
- Every Pre-roll state is honoured: settled ignored, tinted bent, open used (prompt-level assertions).
- Bulk/editor UI carries `preRollSteer` onto the draft.

## Phases

- 0 Design brief (this document). Gate: agreed. — done
- 1 Semantics, data, tests. Gate: all tests green, no UI. — done
- 2 Bulk UI. Gate: manual batch proves picks hold. — done
- 3 Create Persona UI. Gate: same. — done
- 4 Characters: hetero male default, own APPETITE/EXPERIENCE tiers, same contract. — done (THEME, SEXUALITY and tiered EXPERIENCE channels with pickers)
- 5 Polish: presets, weights, per-image overrides.

## Open questions

- Is "Big personality" the right top Energy label in the block, or does it read as a type rather than
  a level?
- Does non-binary default to Bisexual, or to "Default (unresolved)" for the model?
- Should a structured pick outrank text that explicitly contradicts it, or warn?
- Are the four Experience labels right for male cards too ("Hedonist" is neutral; "Virgin" is not
  the issue, "Some experience" maybe is)?
- Does orientation filtering belong in the tier tables, or as a second prompt rule?
- Do we need a "Chaos" axis later, or does Warmth cover enough?
- Should THEME entries stay long enough to carry props, or be short labels with a prompt-side palette
  table? Long entries cost context but survive hand edits.
- World registers (NSFW, NSFL, real consequences) are explicit checkboxes stored on the draft and sent as a WORLD RULES line; consequence realism is spelled out in the world prompt.
- Does a theme pick belong on every card, or only worlds and characters? Personas currently use the
  VIBE/WARMTH axes instead and get setting from SETTING.