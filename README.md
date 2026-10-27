# Card Generator (SillyTavern extension)

Generate personas and character cards from images with a vision-capable Chat Completion model, review them, and save them into SillyTavern.

## Features

- **Create Persona / Create Character**: drop in an image, add optional details, click Generate, edit the result, then create it or save it to Drafts.
- **Bulk Create**: queue many images at once (with shared and per-image details). The queue runs in the background and every result lands in **Drafts**.
- **Drafts**: review, edit, regenerate, approve (one or many), or delete. Drafts and their images persist across reloads. Images are stored in `data/<user>/user/files/stcardgen_*`.
- **Import Card as Persona**: pick `.png`/`.json` character cards. One file opens the editor; several go straight to Drafts.
- **Banned names**: a manual list, plus (optionally) existing persona, character, and draft names, injected into the prompt. Name conflicts are flagged in the editor and in Drafts, and bulk approve skips them.

## Settings

Find them under Extensions → Card Generator.

- **Connection profile**: "Current connection" or any Chat Completion connection profile. The profile's model and preset sampling settings are used.
- **Generation prompt / rules** for personas and characters: your own guidelines.
- **Output format**: the JSON shape the model must return. Keep the keys if you edit it.
- **Ban instruction**: a template that supports `{{bannedNames}}` and `{{type}}`.

Access is also available from the wand menu (Create Persona / Create Character / Card Drafts).

## Install

Copy this folder to `public/scripts/extensions/third-party/stcardgen` and reload SillyTavern. For the local Docker setup, run:

```bash
cp manifest.json index.js style.css settings.html /c/Users/vduke/dockerapps/SillyTavern/extensions/stcardgen/
```
