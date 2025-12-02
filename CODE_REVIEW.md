# CryptoFolio HTML Prototype Review

This document reviews the supplied single-page HTML prototype for the CryptoFolio dashboard and lists recommended changes before merging a pull request that introduces it.

## What works well
- Uses Tailwind via CDN for rapid styling, Chart.js for allocation visuals, and Font Awesome for icons, giving a polished default look.
- Clear component organization (navbar, stats, table, modal, toast) and a small, focused state model (`portfolio`, `marketData`).
- Good UX touches: loading indicator on refresh, empty states, confirmation on delete, animated balance updates, keyboard escape handling for the modal, and mock data fallback when the API fails.

## Recommended changes before merging

1. **Handle API rate limits and user feedback more explicitly**
   - CoinGecko rate limits can still leave the UI stale. Persist the last successful timestamp and surface a visible alert/toast when fresh data cannot be retrieved instead of only changing the “Updated” label.
   - Consider exponential backoff or a capped retry to reduce repeated failed calls.

2. **Guard against missing market data**
   - Several render paths assume `marketData[asset.id]` is defined. Add a defensive check in `updateDashboard()` so division by zero or `undefined` math cannot produce `NaN` in total balance or performance badges when the API returns partial data.

3. **Avoid `innerHTML` for dynamic strings**
   - User-controlled values (e.g., asset names from API) are injected via `innerHTML` in `renderPortfolio()` and `updateDashboard()`. Switch to `textContent` and element creation to reduce XSS surface and improve readability.

4. **Strengthen form validation**
   - Enforce minimum amount and limit decimal precision directly in the input (e.g., `min="0"`, `step="0.00000001"`).
   - Disable the "Add Asset" button until a coin and valid amount are selected to prevent transient error flashes.

5. **Improve accessibility**
   - Add `aria` labels to icon-only buttons (refresh, close modal, delete) and link the modal to the form fields with `aria-describedby`.
   - Ensure focus is trapped within the modal while open and returned to the trigger on close.

6. **Persist theme and reduce layout shift**
   - The page defaults to dark with glassmorphism; if you add a light mode later, persist the chosen theme in `localStorage` and set it before paint to avoid flicker.

7. **Refine data model and calculations**
   - Store asset entries as `{ id, amount, averageCost }` to support gain/loss calculations and display cost basis instead of only 24h change.
   - Normalize portfolio data after loading from `localStorage` to handle corrupted or partially saved entries.

8. **Bundle dependencies for production**
   - Relying on CDN script tags is convenient for prototypes but should be replaced with pinned npm dependencies and a build pipeline for integrity and offline installs.

9. **Testing hooks**
   - Extract the API layer and portfolio state into separate modules so you can add unit tests around price transformation, allocation percentages, and localStorage persistence without needing the DOM.

## Suggested next steps

- Land the template with the defensive guards (items 2–4) and accessibility tweaks (item 5) in the same PR so functionality and a11y regressions are avoided.
- Follow up with a build/bundle migration (item 8) and richer portfolio metrics (item 7) once the UI is stable.
