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
data source. It supplies the original 320 base-game layouts. The DLC extension below is stored separately.


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

## The Forsaken Hollows map facts

`data/map-dlc.json`, `data/map-dlc-geometry.json`, and `data/sources/nightreign-dlc/`
transform public factual parameter CSVs from [xqfinxd/NightreignApp](https://github.com/xqfinxd/NightreignApp/tree/80ea5b3d7492acb15512cac05d6c91dba9f6c82a/nightreign/assets/datas), pinned to `80ea5b3d7492acb15512cac05d6c91dba9f6c82a`.
No application implementation code from that repository is incorporated.
The extension includes patterns 1000–1199 (80 Great Hollow, 120 other terrains),
combined with the unchanged original base catalogue. Original base IDs remain 1–320.
Shared values are aligned using overlapping base-game facts and nearby coordinates;
new sites use the game grid coordinate system with 256-unit tiles.

The 36 surface tiles and underground overlays in `assets/maps/great_hollow*`
come from the same commit's `nightreign/assets/textures/4/MENU_MapTile_L0_*`.
They are losslessly encoded as WebP; underground tiles composite the B1 overlay
onto the corresponding surface tile. They are game imagery owned by FromSoftware
and Bandai Namco, not project-created artwork or covered by the base router's MIT notice.
Source and generated asset hashes are retained in `data/map-dlc-provenance.json`.

Catalogue counts and random first-circle behavior were cross-checked against
[thefifthmatt's layout catalogue](https://thefifthmatt.github.io/nightreign/).
New Nightlord labels follow the simplified Chinese names “安定者们” and “废弃物之王”
([Chinese guide](https://www.gamersky.com/handbook/202512/2054550.shtml)).
Random crystal positions and unidentified internal components are not asserted as fixed observations.

### Divine tower floors

Great Hollow attachment IDs 1114–1116 identify the northwest divine tower's
three floors; 1111–1113 identify the southeast tower's floors. They share one
geographic anchor per tower. This grouping is documented by the pinned upstream
[source mapping](https://github.com/xqfinxd/NightreignApp/blob/80ea5b3d7492acb15512cac05d6c91dba9f6c82a/scripts/generate_spot_list.py).
Floor order and example encounters were cross-checked with the
[annotated layout 1005](https://thefifthmatt.github.io/nightreign/gladius/1005.html).
`floors` preserves all three ordered encounters in each slot. The existing
observation value still represents the third-floor boss, preserving saved links.
Each floor's displayed certainty is evaluated separately across the current candidates.

### Game map pictograms

`assets/map-icons/` contains unmodified game pictograms from the pinned
NightreignApp `nightreign/assets/textures/spots/` directory above, plus the base
router's `public/POI_icons/Spawn_Location.png`. Exact URLs and SHA-256 hashes
are stored in `assets/map-icons/provenance.json`; download with
`tools/import-map-icon-assets.py`. These are game assets owned by FromSoftware
and Bandai Namco, not original artwork of this project.

`tools/import-map-icons.py` associates the existing pinned parameter facts with
existing layout slots and writes `data/map-icons.json`. The `boss` and
`danger_boss` distinctions come from each layout's variation/attachment facts,
not a difficulty ranking invented from an enemy name. Conflicting or missing
facts remain neutral. DLC bound encounters use their own explicit icon field.
The building-symbol vocabulary was cross-checked with the
[official starter guide](https://media-center.bandainamcoent.eu/games/elden-ring-nightreign/ERN_FuturePress_StarterGuide.pdf).
