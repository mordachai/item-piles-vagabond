# Item Piles + Vagabond: Currency/Price Bug — Investigation & Fix Plan

**Repo to edit:** `item-piles-vagabond` (companion bridge module, NOT the vagabond system repo)
**File:** `module/vagabond.mjs`

## Root Cause

`vagabond.mjs` calls `game.itempiles.API.addSystemIntegration(VERSIONS["1.0"])` but the config object never sets `ITEM_PRICE_ATTRIBUTE` or `ITEM_COST_TRANSFORMER`.

Item Piles core (`item-piles.js`, v3.3.3) defaults `ITEM_PRICE_ATTRIBUTE: ""` when missing — merge is silent, no throw, no console warning.

Every price lookup then does:
```js
// item-piles.js:34426 (getItemCost)
return foundry.utils.getProperty(itemData, "") ?? 0;
```
Empty path → always resolves to `0`.

**Result: every Vagabond item prices at 0 gold inside Item Piles.** Merchants sell for free, buy/sell math is nil, vault "total worth" is 0. The GM's manual price-edit field in Item Piles' own item editor also writes to the same empty path and silently does nothing (`item-piles.js:53551`).

## What's Already Correct — Don't Touch

Currency ledger config is fine as-is:
```js
"CURRENCIES": [
  { "type": "attribute", "name": "Gold",   "data": { "path": "system.currency.gold" },   "primary": true,  "exchangeRate": 1 },
  { "type": "attribute", "name": "Silver", "data": { "path": "system.currency.silver" }, "primary": false, "exchangeRate": 0.1 },
  { "type": "attribute", "name": "Copper", "data": { "path": "system.currency.copper" }, "primary": false, "exchangeRate": 0.01 }
]
```
This matches the exact multi-denomination pattern Item Piles supports (same shape dnd5e uses for cp/sp/gp). Core coin-splitting math (`getPriceArray`, uses `Math.floor` per denomination) is built for this — dropping loot piles, giving/taking coins, making change all already work correctly. **No changes needed here.**

## The Actual Mismatch

Item Piles' generic price model wants **one number** per item (a gold-equivalent total). Vagabond splits item cost across **three separate integer fields**:
- `system.baseCost.{gold,silver,copper}` — raw stored value (always in `_source`)
- `system.cost.{gold,silver,copper}` — derived, metal-multiplier applied, computed in `prepareDerivedData()` (NOT in `_source`, only exists on a prepared Item document)

No single field exists anywhere for `ITEM_PRICE_ATTRIBUTE` to point at directly.

## Fix — Bridge Module Only, No System Changes

### 1. Read path: add `ITEM_COST_TRANSFORMER`

This is an escape hatch Item Piles ships specifically for split-currency systems. Signature: `(item, defaultCurrencies, itemPriceAttribute) => number`. Add to the `VERSIONS["1.0"]` config object in `vagabond.mjs`:

```js
"ITEM_COST_TRANSFORMER": (item, defaultCurrencies) => {
  const cost = item?.system?.baseCost
    ?? foundry.utils.getProperty(item, "system.baseCost")
    ?? {};
  return (cost.gold ?? 0) * 1 + (cost.silver ?? 0) * 0.1 + (cost.copper ?? 0) * 0.01;
}
```

Handles both an `Item` document and a plain data object (Item Piles sometimes passes raw rolled-table data, not a live document — confirmed via `rollMerchantTables` in core). Fixes merchant buy/sell math, vault worth totals, trade dialog math — all read paths — with zero system changes.

**Caveat:** uses `baseCost` (raw, pre-metal-multiplier). The derived `system.cost` (post metal multiplier) isn't reliably present on the shapes Item Piles hands to the transformer, since it can be plain compendium-sourced data without prepared derived data. If metal-multiplier-accurate pricing matters for merchant stock, that needs the vagabond system itself to expose the multiplied cost as a stored/source field — a system change, out of scope for this bridge-only fix.

### 2. Write path: set `ITEM_PRICE_ATTRIBUTE`

Still required for the GM's manual price-edit field inside Item Piles' own merchant/item editor UI (it directly `setProperty`s a raw number here). Cheapest fix — point it at:

```js
"ITEM_PRICE_ATTRIBUTE": "system.baseCost.gold"
```

Tradeoff: editing price *from inside Item Piles' UI* only writes whole/fractional gold — silver/copper fields on the item are left as-is (could go stale/inconsistent with what's displayed). Acceptable if GMs keep editing precise item cost on the actual Vagabond item sheet as source of truth, and only use Item Piles' quick-edit for loose loot items that don't need silver/copper precision.

## Bigger-Picture Decision Point

Patching the transformer fixes the math everywhere, but Item Piles' UI (merchant list, vault sell-all, trade dialog) will always display a flattened gold-equivalent number, not a native gold/silver/copper split, and won't reflect the metal-type price multiplier unless the transformer is extended to special-case it.

- **If that flattening is fine for a shop:** apply the two config changes above, done. Cheap, reuses Item Piles' entire merchant/vault/trading UI for free.
- **If exact tri-denomination + metal multiplier + existing hand-limit/slot rules need to show correctly:** the better long-term answer is a native `VagabondShop` ApplicationV2 in the vagabond system itself (reusing `equipment-helper.mjs` equip patterns), instead of continuously writing one-off transformers every time Item Piles assumes "one price number."

## Next Steps

1. Pull latest in `item-piles-vagabond` repo.
2. Add the two config keys above to `VERSIONS["1.0"]` in `module/vagabond.mjs`.
3. Bump module version, test: drag a priced weapon into a merchant pile, confirm displayed price is nonzero and matches gold-equivalent of `baseCost`.
4. Test the GM price-edit field in Item Piles' item editor writes back to `system.baseCost.gold` correctly.
5. Decide (with user) whether flattened-gold display is acceptable long-term or whether to scope a native shop app.
