# Agents

If you are the agent talking to the user, read `MAIN_AGENT.md` first and follow it too.

## Code
- Keep code clean and readable: small files, clear names.
- Don't write code comments, doc files (READMEs, design docs, notes) or tests.
- `TODO.md` is the user's own list. Only edit it when the user asks.
- Build every change as if it had been the design from the start. Rework the existing code fully instead of patching around it. No hacks.
- No backwards compatibility: no data or file migration, no version checks for old data, no legacy code paths. Old data and files may break.
- Base design on evidence. Before making something, find references for it (images, footage, docs) and follow what they show. Don't invent details or take them on assumption.

## Structure
- Organise by feature, not by file type.
- A feature folder keeps its code, assets and config together.
- Split a feature into subfolders as it grows.
- Keep the root small
