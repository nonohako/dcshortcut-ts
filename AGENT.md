# Dccon Alias Feature Notes (Experimental)

## Branch
- Use branch: `exp/dccon-alias-popup`

## Goal
- Provide custom dccon alias workflow:
  - Register alias by right-clicking a dccon icon (`button.img_dccon`).
  - In comment textarea, typing `@alias` opens suggestion popup.
  - `Tab`/`Shift+Tab` cycles suggestions, `Enter` selects.
  - On select: call `/dccon/insert_icon`, then trigger existing comment submit button.

## Data Model
- Storage key: `dcinside_dccon_alias_map`
- Type: `DcconAliasMap`
  - `Record<normalizedAlias, DcconAliasTarget[]>`
  - Target fields: `alias`, `packageIdx`, `detailIdx`, `title?`, `imageUrl?`, `updatedAt`

## Request Flow
- First request:
  - `POST /dccon/insert_icon`
  - Form includes:
    - `id`, `no`, `package_idx`, `detail_idx`
    - plus comment form fields (`name`, `password`, `ci_t`, `check_6~8`, `_GALLTYPE_`, etc.)
  - Success signal: response text contains `"ok"`
- Second action:
  - Trigger existing comment submit button (`button.repley_add`)
  - Do not directly reimplement board-comment rendering logic

## UI Surface
- Shortcut Manager > 고급 기능 > 디시콘 별칭
  - Show saved aliases
  - Delete alias entries
  - Include guide text: right-click icon to register

## Validation Checklist
- `@alias` popup appears only in comment textarea.
- `Tab` navigation and `Enter` confirm work while popup is open.
- Duplicate aliases show multiple selectable targets.
- insert_icon failure does not click submit.
- `npm run type-check`
- `npm run build`
