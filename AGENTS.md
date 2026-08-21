# Horizon project instructions

## Project
Horizon is a Greek-first AI travel-planning website published with GitHub Pages from the `main` branch and repository root.

## Publishing workflow
- When a requested website change is complete and validated, save/publish the completed change to the `main` branch unless the user explicitly asks for preview-only work.
- Use clear, descriptive commit messages.
- Keep the site deployable directly by GitHub Pages from the repository root.
- Preserve existing working functionality unless the user explicitly asks to remove or replace it.
- Before publishing, check the affected HTML/CSS/JavaScript for obvious errors and broken references.

## Technical constraints
- The site must work as a static GitHub Pages site without a required server-side runtime.
- Use relative paths for local assets so the project works under `/horizon/`.
- Do not commit secrets, API keys, passwords, tokens, or private credentials.
- Keep the interface responsive for desktop and mobile.
- Maintain accessible labels, keyboard usability, and readable contrast where practical.

## Product direction
- Brand: HORIZON.
- Primary language: Greek, while keeping the architecture ready for later multilingual support.
- Visual direction: premium dark travel aesthetic, currently based on deep navy backgrounds with warm orange accents.
- Core product: personalized travel planning driven by budget, dates, travelers, origin, destination style, accommodation, transport, interests, duration, and special requirements.
- Prefer useful real functionality over decorative placeholders.
