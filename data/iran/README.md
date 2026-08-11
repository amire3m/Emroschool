# Iran Location Data

The production application serves the repository-owned province, city, and Tehran district location data without runtime GitHub or Gist access. This statement is limited to those location datasets; unrelated endpoints such as `/api/universities` are outside this work's scope. Province and city data are modified GPLv3-covered data; Tehran district labels are independently maintained factual identifiers.

## Province And City Provenance

Original project: [List of cities in Iran](https://github.com/sajaddp/list-of-cities-in-Iran), authored by Sajad Dehshiri (`sajaddp`) and contributors.

Original copyright notice:

```text
List of cities in Iran  Copyright (C) 2025  Sajad Dehshiri (sajaddp)
```

The source project is licensed under the GNU General Public License, version 3. Its pinned `LICENSE` bytes are included verbatim at `data/iran/LICENSE-GPL-3.0.txt`; project-specific notices remain in this README.

Both source files are pinned to commit `474942269f75ec247e1af5684f5e3eca9f304431`:

- Provinces: https://raw.githubusercontent.com/sajaddp/list-of-cities-in-Iran/474942269f75ec247e1af5684f5e3eca9f304431/dist/json/provinces.json
- Cities: https://raw.githubusercontent.com/sajaddp/list-of-cities-in-Iran/474942269f75ec247e1af5684f5e3eca9f304431/dist/json/cities-filtered.json

Retrieved and modified on 2026-08-12.

### Reproducibility

| Artifact | Record count | SHA-256 |
| --- | ---: | --- |
| Pinned upstream `provinces.json` | 31 | `01964b1c357eb21b0152382475357b40d3ca08057f08bba1a09b41161ac31a41` |
| Pinned upstream `cities-filtered.json` | 1,195 | `37e29f9465ed15ee811a585b955c1a468bf62cdb786e3002ac5a748dbb3a8e1b` |
| Modified `data/iran/provinces.json` | 31 | `93299179d54c41cef1848ad3ff6c4e94d05ad357840de6af227286880023cf99` |
| Modified `data/iran/cities.json` | 1,193 | `051b27257a59dd32e62fd007a0ce2a919faa05b275be36ed204f28f38560ca34` |

The hashes are over the exact UTF-8 file bytes. Counts are top-level JSON array lengths.

### Modifications

The following modifications were made on 2026-08-12:

- Projected province records to `{ id, name }`, removing `slug` and `tel_prefix`.
- Projected city records to `{ name, provinceId }`, renaming upstream `province_id` to `provinceId` and removing all other fields.
- Removed two exact duplicate city records within their provinces, preserving each first occurrence and source order.
- Formatted the modified JSON deterministically with two-space indentation and a trailing newline.

All distinct Persian province/city strings and province IDs are unchanged. Applying those transformations to the pinned source files reproduces the committed files exactly.

### GPLv3 Coverage And Source Availability

`data/iran/provinces.json` and `data/iran/cities.json` are modified versions of the pinned upstream data and are distributed under GNU GPLv3. Their preferred source form is the readable JSON committed in this repository. The exact upstream source remains available at the pinned URLs above, and the complete modification recipe is documented here. The byte-identical pinned upstream license is provided in `data/iran/LICENSE-GPL-3.0.txt` with SHA-256 `38edb472781a55161f804518ac43b91726c36fb65db652158e4955baa08f55ba`.

These covered data files are included in an aggregate with separate and independent project files. This GPLv3 notice applies to the modified province and city data files; their inclusion in the aggregate does not by itself apply GPLv3 to independent parts of this repository.

THERE IS NO WARRANTY FOR THE GPLv3-COVERED DATA, TO THE EXTENT PERMITTED BY APPLICABLE LAW. IT IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, INCLUDING MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. See `data/iran/LICENSE-GPL-3.0.txt`, especially sections 15 and 16, for the complete warranty and liability terms.

## Tehran District Labels

`data/iran/tehran-neighborhoods.json` contains 22 independently authored factual labels maintained by this project: `منطقه ۱ شهر تهران` through `منطقه ۲۲ شهر تهران`. Every label maps to an empty array so the existing `Record<string, string[]>` API contract remains stable.

No content from the previously referenced unlicensed Tehran Gist remains in this repository: all copied neighborhood values were removed. The factual district identifiers are not derived from that Gist. Tehran neighborhood entry remains required free text only when both province and city are Tehran.

The district-label file contains 22 keys and has SHA-256 `8bad0d913fb47cefb0cee6a2cccad621db2c889b4f6e3df9ad0ccec8d85b0661` over its exact UTF-8 bytes.

## Manual Updates

1. Choose and record an immutable upstream commit for province/city candidates.
2. Retrieve the two pinned source files outside application runtime and record their byte-level SHA-256 hashes and source counts.
3. Apply only the documented field projection, `province_id` rename, and exact province-scoped duplicate removal while preserving distinct values and source order.
4. Format JSON with two-space indentation and a trailing newline; record resulting hashes and counts.
5. Update the retrieval/modification date, source commit, URLs, attribution, and exact modification notice while retaining the GPLv3 license and warranty notice.
6. Maintain Tehran district labels independently; do not import Gist neighborhood content. Review label changes as factual project-authored edits.
7. Review the complete data/provenance diff and run integrity, route, TypeScript, and repository tests before committing and deploying.
