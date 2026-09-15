# Catalogue audit — 2026-09-15

- Scope: 514 live product records, including all current visibility states.
- Planned corrections: 144 category assignments, 25 primary-image/SKU mismatches, and 7 original watermark-free replacement mockups.
- Safety: only `category_slug` and `images` are updated; stock, pricing, `is_active`, and `is_hidden` are preserved.
- Reference: the supplied Xpertone e-catalogue and matching live SBM catalogue imagery.
- Audit artifacts: `scripts/catalogue-audit.mjs`, `data/catalogue-audit-corrections.json`, and the external SKU manifest in `outputs/catalogue-mockups`.

