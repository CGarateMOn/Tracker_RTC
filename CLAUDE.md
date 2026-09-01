# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RTC · Ofertas is a static, single-page tracker of consulting internship/job listings, in Spanish. It is plain HTML/CSS/JS with **no build step, no package manager, and no dependencies** beyond two Google Fonts loaded via `<link>` in [index.html](index.html). The entire app is three files:

- [index.html](index.html) — markup only: the onboarding "intro" screen, the "gate" (prácticas / contrato laboral / ambas) chooser, the filter bar, and the list container.
- [script.js](script.js) — all logic (state, filtering, rendering, persistence, data loading). Single file, no modules.
- [style.css](style.css) — all styling. Mobile-first; desktop overrides live only inside `@media (min-width:1024px)` blocks so mobile styles are never touched by desktop tweaks.

## Running locally

There is no dev server or build command. Serve the directory statically and open it, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000/`. Opening `index.html` directly via `file://` mostly works but the `fetch('datos.json')` call will fail under some browsers' CORS rules for local files, so prefer a static server.

There is no linter, formatter, or test suite in this repo — do not invent npm scripts or assume a package.json exists.

## Data pipeline

Listings live in [datos.json](datos.json) at the repo root: `{actualizado: <ISO date>, ofertas: [...]}`, with raw fields in Spanish/capitalized form (`ID`, `Empresa`, `Descripción`, `Tipo de Oferta`, `Estado`, `Ciudad`, `Link`, `Deadline`, `Práctica`, `Modalidad`, `Curso`, `Tipo de plazo`, `Fecha de alta`).

[.github/workflows/actualizar-datos.yml](.github/workflows/actualizar-datos.yml) runs hourly (`cron: '0 * * * *'`, plus manual `workflow_dispatch`): it curls the Google Apps Script endpoint in the `APPS_SCRIPT_URL` secret, validates the response is JSON, overwrites `datos.json`, and commits/pushes only if the content changed. This is the only place `datos.json` should ever be updated from — don't hand-edit it except for local testing.

In the browser, `script.js` loads data in three layers (see the comment block above `CARGADO` in [script.js:509](script.js#L509)):
1. Fetch `datos.json` (fast, static) and render immediately if it succeeds.
2. Otherwise fall back to the last copy cached in `localStorage` (`K_DATOS`).
3. Otherwise render skeleton cards until data arrives.

After the first paint, `refrescar()` polls the *live* Apps Script endpoint (`API_URL` at the top of [script.js](script.js), currently a hardcoded `/exec` URL — replace with `PEGA_AQUI...` semantics if wiring a fresh sheet) in the background, with retry/backoff (`REFRESCO_ESPERAS_MS`), in case `datos.json` is stale. If the user has active filters when new data arrives, it's held in `PENDIENTE` and surfaced as a "Hay datos más recientes" prompt rather than silently re-rendering under them.

Raw sheet rows are normalized once via `norm()` ([script.js:45](script.js#L45)), which accepts either the Spanish capitalized sheet field names or already-normalized ones (`g('tipo','Tipo de Oferta')` pattern), and coerces `tipo`/`estado` into a small fixed vocabulary via regex.

## Core state and rendering model

Everything revolves around a single mutable state object `S` ([script.js:40](script.js#L40)) holding active filter sets (`practica`, `modalidad`, `ciudad`, `empresa`, `plazo`, `curso`, `estado`, `seg`), plus `soloFav`, `orden`, and `q` (search text). There's no framework: `render()` ([script.js:392](script.js#L392)) re-derives everything from `S` + `TODAS` (the normalized listing array) and does a full `innerHTML` re-render of the filter panel and list on every change, preserving which `<details class="drop">` panels were open across the re-render.

Filtering logic is centralized in `pasa(o, salta)` ([script.js:207](script.js#L207)), which checks an offer against every active filter except the one named by `salta` — this "skip self" pattern is what lets `cuenta()` compute per-option result counts (e.g. "Madrid (12)") without the option's own filter suppressing its own count.

Two independent localStorage-backed maps track user-specific data, keyed by `claveOferta(o)` ([script.js:152](script.js#L152)) — not by company, so saving one McKinsey offer doesn't mark all McKinsey offers:
- `FAV` — a `Set` of saved/starred offer keys.
- `SEG` — a map of offer key → application status (`aplicada`/`entrevista`/`oferta`/`rechazada`); absence means "not tracked" and is never persisted as an explicit value.

`claveOferta()` prefers the sheet's `id:<ID>` when present, else falls back to a composite of company/description/city/date — meaning tracking state for an offer can be silently orphaned if those fields change later and the ID hasn't propagated yet (documented as an accepted limitation of having no backend).

All persistence is plain `localStorage` under the `K_*` prefixed keys near the top of [script.js](script.js) (`rtc-datos-v2`, `rtc-filtros-v2`, `rtc-favoritas-v2`, `rtc-gate-v1`, `rtc-seguimiento-v1`, `rtc-intro-v1`) — there is no account system or server-side sync; wiping browser storage loses favorites/tracking/filters permanently.

## Brand color matching

`MARCAS` ([script.js:75](script.js#L75)) maps each parent firm to one color, and lists its sub-brands under `ramas` so they inherit that color (e.g. QuantumBlack gets McKinsey's blue, Monitor Deloitte gets Deloitte's green). Only sub-brands whose name does *not* already contain the parent's name need a separate `ramas` entry. `colorMarca()` matches by whole-word substring (via `enPalabras()`, which pads with spaces so `"ey"` matches "EY" but not "Kearn**ey**") using longest-key-first precedence, and falls back to a deterministic hash-based HSL color for any company not listed — so new companies appearing in the sheet never break rendering, they just get an unlisted-but-stable color.

## Deadline/urgency logic

`o.deadline` arrives either as a plain date (`"2026-09-04"`) or a full ISO timestamp with `Z` (when Apps Script serializes a `Date` object). `fechaDeadline()` ([script.js:175](script.js#L175)) is the single parse point for this — any new code needing the deadline date must go through it rather than reading `o.deadline` directly, to avoid UTC-offset day-shift bugs. `plazo()` ([script.js:186](script.js#L186)) derives the display text and urgency level (`preview`/`cerrada`/`rolling`/`sinfecha`/`critico`/`proximo`/`lejano`) from state + days-remaining, in a fixed priority order documented in the comment above it.

## Onboarding flow

`#intro` (first-run only, gated by `K_INTRO` in localStorage) and `#gate` (prácticas/contrato laboral/ambas chooser, shown once per gate reset) are full-screen overlays toggled via `.on` classes. The intro screen contains *functional* preview widgets (`.mock-fav`, `.mock-seg`) that use distinct `mock-*` classes specifically so they can't accidentally bind to the real app's delegated event listeners or mutate `FAV`/`SEG`/`S` — see the comments at [script.js:436](script.js#L436) and [script.js:468](script.js#L468) before adding new mock elements.

All interactivity is delegated: a single `document.addEventListener('click', ...)`, `('change', ...)`, and `('input', ...)` handler each, dispatching on `e.target.closest(...)` / `dataset` attributes rather than per-element listeners — follow this pattern when adding new controls instead of attaching listeners to individual rendered elements (which get destroyed on every re-render anyway).
