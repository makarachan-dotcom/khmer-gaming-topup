# Uploaded MLBB Asset Mapping Notes

The uploaded `products.json` and `products_flat.json` describe a Mobile Legends (Khmer) catalog with 49 product records, each including a product name and an image URL. Examples include official-looking Weekly Pass variants, diamond-and-bonus bundles, and Twilight Pass Miya. These source labels will be used only as an asset-matching reference; their prices, badges, and availability are not imported into the ZURS STORE provider catalog.

Local provider review confirmed that the ZURS STORE Mobile Legends route remains provider-authorized and requires Player ID and Server ID before customer package browsing. No player ID, player name, payment, or order action was entered during the review. The route uses the current official Mobile Legends provider-artwork endpoint for the game logo.

The current FZR Cards preview included provider labels for `Weekly Pass` and `Twilight Pass`. Two owner-supplied assets were mapped only to those exact provider labels: the uploaded `Weekly Pass x1` asset is a documented canonical single-pass alias for `Weekly Pass`, and `Twilight Pass Miya` is a documented variant-name alias for `Twilight Pass`. No diamond, bonus, multi-pass, monthly, Elite Pack, price, badge, or availability record from the uploaded source catalog is imported. MLBB currency cards retain the established gold diamond chest artwork.

The official MLBB route was also confirmed to have an authorized Admin Preview control available for a non-transactional package-card visual audit. No customer identity fields, payment actions, or order actions will be used during that review.

Before the mapping release, the official Admin Preview loaded its provider-derived diamond, bonus, and pass sections. The existing gold diamond chest rendered on visible diamond and bonus cards, while the pass section retained an official Mobile Legends logo treatment. This established the protected visual baseline for the subsequent cache-fresh release check.

The cache-fresh official route with release marker `2ef636e3` loaded the authenticated admin control surface successfully. The follow-up inspection will use the built-in Admin Preview only; it will not enter customer identity fields or create an order.

The cache-fresh Admin Preview verified the published result: MLBB diamond and bonus cards still use the legacy gold diamond chest; the two visible `Weekly Pass` cards use the approved uploaded Weekly Pass image with the official Mobile Legends logo overlay; and the visible `Twilight Pass` card uses the approved uploaded Twilight Pass image with the same overlay. Provider names, amounts, prices, category grouping, and disabled purchase behavior were unchanged. No broken image or question-mark artwork appeared in the reviewed card grid.
