# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Foundry VTT module — bridges the **Vagabond** game system with the **Item Piles** module. It's a companion/integration module, not a full Foundry module: single-purpose, registers Vagabond's item/currency schema with Item Piles' API so loot piles, merchants, and trading work for Vagabond actors/items.

- **Requires** the `item-piles` module and `vagabond` system to be installed (declared in [module.json](module.json) `relationships`).
- No build step, no bundler, no dependencies. Just one ES module loaded directly by Foundry.
- Foundry compatibility: v12 minimum, v14 verified/max (see module.json).

## Architecture

All logic lives in [module/vagabond.mjs](module/vagabond.mjs). On the `item-piles-ready` hook, it calls:

```js
game.itempiles.API.addSystemIntegration(VERSIONS["1.0"])
```

`VERSIONS["1.0"]` is a config object matching Item Piles' system-integration schema. Key fields and what they mean for Vagabond specifically:

- **Item type collapse**: Vagabond has no separate weapon/armor/loot item types — everything physical is type `"equipment"`, distinguished by `system.equipmentType`. So `ITEM_CLASS_LOOT_TYPE`, `ITEM_CLASS_WEAPON_TYPE`, `ITEM_CLASS_EQUIPMENT_TYPE` all point to the same `"equipment"` string.
- **ITEM_FILTERS**: excludes non-physical item types (`ancestry,class,perk,starterPack,spell`) from being lootable/piled.
- **ITEM_SIMILARITIES**: stacking dedup key is `["name", "type", "system.equipmentType"]` — the equipmentType is required or differently-typed equipment with the same name would incorrectly stack.
- **CURRENCIES**: three-denomination ledger (gold/silver/copper) mapped to `system.currency.{gold,silver,copper}`, exchange rates 1 / 0.1 / 0.01. This is the dnd5e-style multi-denomination pattern Item Piles natively supports — don't collapse it to a single currency.

### Known gap — item pricing (see [item-piles-currency-fix.md](item-piles-currency-fix.md))

The currency *ledger* (above) is correct and working. Item *pricing* is a separate, currently-unset concern:

- Vagabond stores per-item cost as three separate fields, `system.baseCost.{gold,silver,copper}` (raw/source) and derived `system.cost.{gold,silver,copper}` (post metal-multiplier, only present on prepared documents) — there's no single numeric field for Item Piles' `ITEM_PRICE_ATTRIBUTE` to read.
- The config currently has neither `ITEM_PRICE_ATTRIBUTE` nor `ITEM_COST_TRANSFORMER` set, so Item Piles' default empty-path lookup silently resolves every item price to `0`.
- The investigation doc above has the concrete fix (an `ITEM_COST_TRANSFORMER` closure flattening `baseCost` to a gold-equivalent number, plus pointing `ITEM_PRICE_ATTRIBUTE` at `system.baseCost.gold` for the GM manual-edit path) and the tradeoffs (flattened gold-equivalent display, metal-multiplier not reflected). Read it before touching pricing.

## Making changes

- Edit [module/vagabond.mjs](module/vagabond.mjs) directly — there's nothing to compile.
- When adding a new schema version, add a new key to `VERSIONS` (e.g. `"1.1"`) rather than mutating `"1.0"` in place, and update the `version` const used to select it. This preserves the pattern for future Item Piles/Vagabond schema changes.
- Bump `version` in [module.json](module.json) when releasing — the GitHub Actions workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) triggers a release **only** on pushes to `main` that modify `module.json`, and zips `module.json` + `module/` into `module.zip` for that tag.
- No test suite exists. Validate changes by loading Vagabond + Item Piles in Foundry and checking the console for the integration warning (`"Vagabond Item Piles | Item Piles module not found or API not ready."`) plus manually testing loot piles / merchant pricing / currency exchange in-world.
