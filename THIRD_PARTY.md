# Third-party data notices

## Elden Ring Nightreign Legal Relic Generator

The generated relic ruleset uses factual parameter records transformed from
[`ip1259/Elden-Ring-Nightreign-Legal-Relic-Generator`](https://github.com/ip1259/Elden-Ring-Nightreign-Legal-Relic-Generator),
licensed under GPL-3.0. The source commit and SHA-256 of every imported file are
embedded in `data/game-data.json`. No game executable, archive, save file, or
`regulation.bin` is included.

The project is unofficial and is not affiliated with FromSoftware or Bandai
Namco. Game names and extracted text remain the property of their respective
owners.

## Nightreign Map Router

The base-game map pattern prototype transforms the pattern catalogue published
by [`NikVince/nightreign-map-router`](https://github.com/NikVince/nightreign-map-router),
licensed under the MIT License. That catalogue credits thefifthmatt as its early
data source. It covers 320 base-game layouts and is intentionally labelled as an
older, incomplete snapshot rather than current DLC coverage.


### Interactive map assets

`data/map-geometry.json` and `assets/maps/` use the same pinned upstream commit
`268bca49a963d9d8fab31ea169db9097019e3174`. The importer reads the active
`public/assets/maps/poi_coordinates_with_ids.json` and `src/utils/poiLocationMapping.ts`,
including category-specific Minor Erdtree and separate spawn mappings.
The upstream MIT notice is retained at `assets/maps/LICENSE.txt`.
Game map imagery remains the property of FromSoftware and Bandai Namco; the
repository license is not a claim of ownership of those game assets.

The 180 original WebP tiles cover five surface terrains. They are stored locally,
without runtime hotlinking. `tools/import-map-geometry.py` records asset SHA-256
checksums. Normalized point coordinates use `(x - 507) / 1690, y / 1690` from the
upstream coordinate alignment guide. The tile grid uses source indices
`(column, 5 - row)`, following the upstream MapCanvas renderer; images themselves
are not rotated. These assets add spatial interaction, not new layout records.
