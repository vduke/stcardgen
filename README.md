# Card Generator (SillyTavern extension)

Generate personas, character cards, and persona-centered sandbox worlds with a vision-capable Chat Completion model. Review the results, then save them into SillyTavern.

## Features

- **Create Persona / Create Character**: drop in an image, add optional details, click Generate, edit the result, then create it or save it to Drafts. With no image, the model also suggests an **image prompt** that you can copy into ComfyUI.
- **Create World for Persona**: builds a living sandbox around one of your personas:
  - a narrator/game-master **sandbox character card** (setting overview, scenario, opening scene);
  - a **lorebook** of NPCs, places, factions, customs and story hooks, with keywords, secondary keywords, constants, priorities, positions and probabilities;
  - the lorebook is attached to the sandbox card as its primary lorebook and embedded in the card. The persona itself is never changed, so you can use it in other roleplays.

  You can edit every entry, use **Add more entries** to fill gaps, and use **Fix overused names** to have the model rename NPCs with stock names everywhere they appear.
- **Bulk Create**: queue many images at once, with shared and per-image details. The queue runs in the background and every result lands in **Drafts**.
- **Drafts**: review, edit, regenerate, approve (one or many), or delete personas, characters and worlds. Drafts and their images persist across reloads. Images are stored in `data/<user>/user/files/stcardgen_*`.
- **Import Card as Persona**: pick `.png`/`.json` character cards. One file opens the editor; several go straight to Drafts.
- **Banned names**:
  - your own list, plus a default list of overused AI names (Elara, Thorne, Vance…), plus optionally the names of existing personas, characters and drafts;
  - all of these are injected into the prompt;
  - exact duplicates are flagged and skipped by bulk approve; overused names are flagged as warnings.

## Settings

Find them under Extensions → Card Generator.

- **Connection profile**: "Current connection" or any Chat Completion connection profile. The model and the preset's sampler settings are used; the preset's prompts are not.
- **Generation prompt / rules** for personas, characters and worlds: your own guidelines.
- **Output format**: the JSON shape the model must return. Keep the keys if you edit it.
- **Entries per generation / World max tokens**: the size of each world generation.
- **Image prompts**: turn suggestions on or off, and edit the instruction.
- **Ban instruction**: a template that supports `{{bannedNames}}` and `{{type}}`.

The wand menu also has Create Persona, Create Character, Create World for Persona, and Card Drafts.

## Install

Install it from the repo URL with SillyTavern's built-in extension installer, or copy this folder to `public/scripts/extensions/third-party/` and reload SillyTavern. For the local Docker setup, run:

```bash
cp manifest.json index.js world.js style.css settings.html /c/Users/vduke/dockerapps/SillyTavern/extensions/stcardgen/
```
