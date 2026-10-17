# Research notes

Why Shelf Check exists and why each part works the way it does.

| Change | Source | Why |
| --- | --- | --- |
| The whole tool | [Victoria University of Wellington, Sept 2026: 26% of products had a quantity surcharge](https://www.wgtn.ac.nz/news/2026/09/the-supermarket-surcharge-you-may-not-know-youre-paying) | In 38 NZ supermarkets, about a quarter of products sold in several sizes had a bigger pack that cost more per unit. International studies put it at 10 to 30%. |
| One unit for every item | [NJ fines Walmart $1.64M over unit prices (2024)](https://couponsinthenews.com/2024/06/20/walmart-is-penalized-1-6-million-over-confusing-prices/) | Inspectors found over 2,000 shelf tags using the wrong unit, with similar products priced per can, per pound or per 100-count. So the shelf's own unit price cannot be trusted to compare. |
| Unit switch matches the labels | [UK CMA open letter on unit pricing (2023)](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1172288/Open_Letter_to_grocery_retailers_on_the_use_of_unit_pricing.pdf) | The CMA asked UK grocers to stop mixing units across packs of the same product. Defaulting to the unit the labels use keeps the numbers checkable against the shelf. |
| Bigger-pack warning | [Which? on "Bigger Pack Better Value" bags (via Pocklington Post)](https://www.pocklingtonpost.co.uk/news/supermarkets-misled-public-over-prices-1957592) | A 2 kg spaghetti bag labelled better value cost 27p more than two 1 kg bags. The example on the page is built on that case. |
| Offers counted per pack | [CHOICE on unit pricing](https://www.choice.com.au/shopping/everyday-shopping/supermarkets/articles/unit-pricing-in-supermarkets) | Shelf unit prices usually ignore multi-buy offers, so a "3 for $5" can look worse or better than it is. |
| 2/$5 and 1/2 gal | US shelf tag formats | US stores print multi-buys as 2/$5 and sizes as fractions, and these were rejected before. |
| Works offline | Weak phone signal inside large stores | The tool is used standing in the aisle, so it must load with no connection. |
| Loyalty / member price | [CMA review of loyalty pricing in groceries (final findings, 27 Nov 2024)](https://www.gov.uk/government/news/groceries-loyalty-prices-offer-genuine-savings-says-cma) | Across ~50,000 products at five supermarkets, loyalty members saved 17% to 25% on average, and the CMA found little sign of inflated "usual" prices. But 40% of shoppers did not trust loyalty prices were a genuine saving. So Shelf Check lets you count the card price and shows whether it changes the best buy, rather than ignoring it or taking it on faith. |
