# Pemberton Company Hub

A recreation of the Pemberton Company Hub intranet (originally at pemberton-flows.onrender.com), rebuilt as a static site so the team can host, study and extend it.

Pure HTML/CSS/JS — no build step. Open `index.html` or serve the folder with any static server.

## Pages

- `index.html` — home dashboard (9 accordion sections: transactions, marketing, people, assets, library, calendars, tools)
- `transaction-services.html` — hub for the 5 guided transaction wizards
- `buyer-under-contract.html`, `new-listing.html`, `listing-under-contract.html`, `outgoing-referral.html`, `cancel-relist.html` — document-first wizards (upload/sample docs → auto-filled confirm step with source tags → conditional questions → review → confetti confirmation)
- `listing-marketing.html` — marketing order flow (property → packages or à la carte services → access → schedule → review cart → confirmation)
- `refer-agent.html` — agent-referral form with stacking bonus tiers
- `policies.html` — searchable handbook (⌘K search, sidebar TOC)
- `office-exclusives.html` — filterable in-house listings table
- Resource pages: `client-flyer.html`, `photography-checklist.html`, `staff-directory.html`, `office-information.html`, `affiliate-companies.html`, `logos-brand-guide.html`

## Shared code

- `css/hub.css` — the Pemberton brand system (navy/gold/cream, rounded cards, dotted rules, tagline footer band)
- `js/wizard.js` — config-driven wizard engine used by all 5 transaction flows (each page defines a `window.WIZARD` object: confirm fields with document-source tags, questions with conditional `reveals`, validation, review summary, success stats)
- `js/confetti.js` — brand-colored confetti burst for success screens

All names, phone numbers, prices and listings are sample data.
