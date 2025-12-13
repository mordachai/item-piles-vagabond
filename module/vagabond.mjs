Hooks.once("item-piles-ready", async () => {

    const VERSIONS = {
        "1.0": {
            "VERSION": "1.0",

            // All physical items in Vagabond are type "equipment", 
            // distinguished by "system.equipmentType" (weapon, armor, relic, etc.)
            "ACTOR_CLASS_TYPE": "character",
            "ITEM_CLASS_LOOT_TYPE": "equipment",
            "ITEM_CLASS_WEAPON_TYPE": "equipment",
            "ITEM_CLASS_EQUIPMENT_TYPE": "equipment",

            // The path to the quantity value on an item
            "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",

            // Filter out abstract items so only physical "equipment" can be looted
            "ITEM_FILTERS": [
                {
                    "path": "type",
                    "filters": "ancestry,class,perk,starterPack,spell"
                }
            ],

            // We must include 'system.equipmentType' to distinguish between subtypes 
            // if items share similar names.
            "ITEM_SIMILARITIES": ["name", "type", "system.equipmentType"],

            // Items that should never stack
            "UNSTACKABLE_ITEM_TYPES": [],

            // Currency definitions matching Vagabond's data paths
            "CURRENCIES": [
                {
                    "type": "attribute",
                    "name": "Gold",
                    "img": "icons/commodities/currency/coin-embossed-crown-gold.webp",
                    "abbreviation": "{#}GP",
                    "data": {
                        "path": "system.currency.gold"
                    },
                    "primary": true,
                    "exchangeRate": 1
                },
                {
                    "type": "attribute",
                    "name": "Silver",
                    "img": "icons/commodities/currency/coin-engraved-moon-silver.webp",
                    "abbreviation": "{#}SP",
                    "data": {
                        "path": "system.currency.silver"
                    },
                    "primary": false,
                    "exchangeRate": 0.1
                },
                {
                    "type": "attribute",
                    "name": "Copper",
                    "img": "icons/commodities/currency/coin-engraved-waves-copper.webp",
                    "abbreviation": "{#}CP",
                    "data": {
                        "path": "system.currency.copper"
                    },
                    "primary": false,
                    "exchangeRate": 0.01
                }
            ]
        }
    };

    // Initialize the module integration
    const version = "1.0"; 
    if(game.itempiles?.API) {
        await game.itempiles.API.addSystemIntegration(VERSIONS[version]);
    } else {
        console.warn("Vagabond Item Piles | Item Piles module not found or API not ready.");
    }
});