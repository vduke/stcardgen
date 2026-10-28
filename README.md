# Card Generator (SillyTavern extension)

Generate personas, character cards, and persona-centered sandbox worlds with a vision-capable Chat Completion model. Review the results, then save them into SillyTavern.

## Features

- **Create Persona / Create Character**: drop in an image, add optional details, click Generate, edit the result, then create it or save it to Drafts. With no image, the model also suggests an **image prompt** that you can copy into ComfyUI.
- **Create World for Persona**: builds a living sandbox around one of your personas:
  - a narrator/game-master **sandbox character card** (setting overview, scenario, opening scene);
  - a **lorebook** of NPCs, places, factions, customs and story hooks, with keywords, secondary keywords, constants, priorities, positions and probabilities;
  - the lorebook is attached to the sandbox card as its primary lorebook and embedded in the card. The persona itself is never changed, so you can use it in other roleplays.

  You can edit every entry, use **Add more entries** to fill gaps, and use **Fix overused names** to have the model rename NPCs with stock names everywhere they appear.
- **Quality pass**: after generation, a second request scores the result 1–10 on specificity, consistency, playability, rules and efficiency (worlds also get keywords and coverage), and lists concrete issues.
  - Personas are judged as personas. The reviewer never asks for a first message, greetings or example dialogue, and such issues are dropped if it raises them anyway.
  - **Fix issues** sends back a patch of only the fields or entries that need to change, then re-reviews. Untick an issue to leave it alone; unticking a name issue keeps that name.
  - **Your instructions** steer Fix, Enhance, Optimize, New name and the per-field buttons (e.g. "keep her shy, no tragic backstory"). With no ticked issues, Fix applies just your instructions.
  - **New name** (next to the Name field) picks a fresh name and replaces the old one everywhere it appears, including first-name-only and surname-only mentions. Banned, overused and already-taken names are rejected. Undo brings the old name back.
  - **Enhance** and **Optimize** grow or trim the whole card, a single field, or a single lorebook entry. A rewrite that goes the wrong way is rejected.
  - **Undo** reverts any AI change.
  - Token counts are shown per field and in total. For worlds you also see the lorebook total and the always-on (constant) cost.
  - Banned names are detected in code anywhere in the text. They are renamed by a dedicated step that rejects banned suggestions, not by the model's general fix.
  - **Auto mode** reviews every generation, including bulk, and fixes once when the score is below a threshold or banned names are found. Drafts show a ★ score badge.
  - A **reviewer connection profile** lets a different model do the grading. Self-review is lenient.
- **Bulk Create**: queue many images at once, with shared and per-image details. The queue runs in the background and every result lands in **Drafts**. **Run queue** processes everything queued; **Regenerate** on a card (or on the selected cards) generates only those, so drafts left queued by a stopped batch stay put.
- **Drafts**: review, edit, regenerate, approve (one or many), or delete personas, characters and worlds. Drafts and their images persist across reloads. Images are stored in `data/<user>/user/files/stcardgen_*`.
- **Import Card as Persona**: pick `.png`/`.json` character cards. One file opens the editor; several go straight to Drafts.
- **Manage Personas**: your installed personas, with score badges.
  - **Review & edit** opens the same editor with review, fix, enhance, optimize, instructions and undo. **Save Persona** writes the changes back to that persona.
  - The globe button builds a world around that persona.
  - **Review selected** scores many personas at once without changing them.
  - **Delete selected** deletes the ticked personas after a confirmation. The current and default personas are skipped.
  - **Remove duplicates** finds personas with the same name, the same description and the same avatar picture, and deletes the extra copies.
    - Pictures are compared by how they look, not by file, so a copy that SillyTavern cropped, resized and renamed on upload still matches. Bulk-uploaded "[Unnamed Persona]" entries are told apart by picture alone.
    - Copies used in any chat, linked to a character, holding a lorebook, or set as current or default are always kept.
    - Only copies showing the same picture are ticked. A merely similar one (cropped differently, say) is listed for you to check.
    - You confirm the list before anything is deleted.
- **Task panel**: slow work shows in a floating panel (bottom right) with progress, the current step, a running timer and a Stop button where it applies. This covers bulk generation, approvals, imports, reviews, duplicate scans and single AI calls. Click its header to collapse it. Buttons that start a run are disabled while it runs, so repeated clicks no longer create things twice.
- **Banned names**:
  - your own list, plus a default list of overused AI names (Elara, Thorne, Vance…), plus optionally the names of existing personas, characters and drafts;
  - all of these are injected into the prompt;
  - exact duplicates are flagged and skipped by bulk approve; overused names are flagged as warnings.

## Settings

Find them under Extensions → Card Generator.

- **Connection profile**: "Current connection" or any Chat Completion connection profile. The model and the preset's sampler settings are used; the preset's prompts are not.
- **Vision profile**: a separate vision-capable profile that reads images, so your generation model doesn't need vision.
  - It describes the image first (persona/character images and world art, bulk included), and the generation model writes from that description.
  - The description appears in the editor under the image. Edit it to correct what the vision model saw; Regenerate reuses it. Clear it, or change the image, to have the image described again.
  - "Same as generation" sends images straight to the generation model, as before. The description instruction is editable.
- **Jailbreak / extra system instructions**: text appended to the end of the system prompt of every request the extension sends (generation, worlds, reviews, fixes, enhance/optimize, renames). Use it for content rules or a jailbreak your preset would normally carry. Untick "Append to every system prompt" to switch it off without losing the text.
- **Generation prompt / rules** for personas, characters and worlds: your own guidelines.
- **Output format**: the JSON shape the model must return. Keep the keys if you edit it.
- **Entries per generation / World max tokens**: the size of each world generation.
- **Quality pass**: the reviewer profile, auto-review, the auto-fix threshold, and the review rubric and Enhance/Optimize instructions.
- **Image prompts**: turn suggestions on or off, and edit the instruction.
- **Ban instruction**: a template that supports `{{bannedNames}}` and `{{type}}`.

The wand menu also has Create Persona, Create Character, Create World for Persona, Manage Personas, and Card Drafts.

## Install

Install it from the repo URL with SillyTavern's built-in extension installer, or copy this folder to `public/scripts/extensions/third-party/` and reload SillyTavern. For the local Docker setup, run:

```bash
cp manifest.json index.js world.js quality.js tasks.js manager.js style.css settings.html /c/Users/vduke/dockerapps/SillyTavern/extensions/stcardgen/
```
