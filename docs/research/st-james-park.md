# St James' Park: research notes

Facts gathered to check and correct the approximate St James' Park model
([src/config/venues/stJamesPark.ts](../../src/config/venues/stJamesPark.ts)). Checked 2026-11-26.
Model compass letters: N = Milburn, E = Leazes, S = East Stand, W = Gallowgate.

## Sources

| Source | Date | What it gives |
|---|---|---|
| Club, [Our Stadium](https://www.newcastleunited.com/en/matchday-information-hub/our-stadium) → "Seating Categories" PDF | file updated 11 Aug 2026 | **Official block map**: every block label, its level and position, and the visiting supporters' area |
| Club, same page → "Stadium Map" PDF | file updated 11 Aug 2026 | Turnstiles and entrances; away turnstiles 89–94 and away ticket office behind the Leazes Stand. No block names |
| Club, [Level 7 Singing Section](https://www.newcastleunited.com/en/news/seat-swaps-last-chance-to-secure-your-season-ticket-in-the-level-7-singing-section) | 6 Jul 2026 | Singing section: "Leazes West Corner Blocks L7C, L7D and L7E", next to the away fans, over 1,700 spaces |
| Club, [Fan Advisory Board June summary](https://www.newcastleunited.com/en/news/fan-advisory-board-minutes-from-june-meeting) → minutes PDF (meeting 8 Jun 2026) | 3 Jul 2026 | New screens planned; a **Gallowgate screen** confirmed, to "face outward"; no seats lost, no views affected |
| Club, [St. James' Park improvements](https://www.newcastleunited.com/en/news/st-james-park-improvements) | 21 Aug 2026 | Four new in-bowl replay screens installed (no positions or sizes); capacity now **52,719**; new safe standing on Level 7 |
| Club, [26/27 season ticket information](https://www.newcastleunited.com/en/news/26-27-season-ticket-information) | 6 Mar 2026 | New higher-visibility bowl screens planned (no positions) |
| BritBrief, [new scoreboards](https://britbrief.co.uk/business/tech/newcastle-united-to-install-new-scoreboards-at-st-james-park.html) (citing ChronicleLive and the FAB minutes) | Jul 2026 | Two new scoreboards, Strawberry Corner and Gallowgate End; Leazes End screen replaced |
| NewcastleWorld article cited by Gemini (Milburn screen) | — | Could not be opened (HTTP 403). Unconfirmed |
| A View From My Seat, [St James' Park sections](https://aviewfrommyseat.com/venue/St+James%27+Park/sections/) | fetched 26 Nov 2026 | 362 fan photos tagged with block, row and seat across 128 blocks: row letters, seat numbers and the corner prefixes. User-entered, so single tags can be wrong |

The club PDFs and images are not copied into the repo; only the facts below are.

## Block map (club "Seating Categories", 2026-27)

Labels are as printed on the club's map: short codes that repeat between stands (there is an
`L7A` in both the Milburn and the Leazes Stand). Third-party ticket sites prefix them with the
stand (`MSL1A`, `ESA`, `GSQ`), which matches the fan photo labelled "GS-Q".

Orders below are **left to right as seen sitting in that stand facing the pitch**.

### Milburn Stand (model N), left = Leazes end, right = Gallowgate end
- **Level 7 (L7, back):** L7H, L7G, L7F (Category 2), L7E, L7D, L7C, L7B, L7A (Family Area). 8 blocks.
- **LL7 (front rows of Level 7):** LL7H, LL7G, LL7F, LL7E … LL7A, one under each L7 block.
- **L4:** L4H, L4G, L4F, L4E | L4D, L4C, L4B, L4A (corporate hospitality).
- **L2 (Platinum Club):** L2H, L2G, L2F, L2E | L2D, L2C, L2B, L2A.
- **LL2 (Bar 1892, front of L2):** LL2H … LL2E | LL2D … LL2A.
- **L3 (Directors Box):** L3D, L3C, L3B, at halfway between the two halves above.
- **L1 (lower, pitchside):** L1I, L1H, L1G, L1F, [players' tunnel], L1D, L1C, L1B, L1A. 8 blocks; there is no L1E (the tunnel takes its place).

### Milburn–Leazes corner (model NE): Leazes Stand numbering
- **Level 7:** L7A, L7B (where Milburn meets the curve), L7C, L7D, L7E (round the corner). L7C–L7E: the 2026-27 singing section, with safe standing.
- **LL7:** LL7A, LL7B, LL7C, LL7D, LL7E.
- **L4 (Category 3):** L4A–L4F round the corner.
- **L2:** L2A, L2B, L2C, L2D round the corner.

### Leazes Stand (model E), left = East Stand end, right = Milburn end (as seen from the stand)
- **Level 7 (Visiting Supporters, safe standing):** L7M, L7L, L7K, L7J, L7H, L7F (no L7G or L7I). 6 blocks, the whole straight upper tier.
- **LL7 (front of Level 7, also visiting):** LL7M, LL7L, LL7K, LL7J, LL7H, LL7F.
- **L6 (Park Grill):** L6E … L6A, at the front of Level 7.
- **L4:** L4X, L4W, L4V, L4U, L4T.
- **L2:** L2S, L2R, L2Q, L2SB (Wings), L2P, L2N, L2M.
- **L1 (lower):** L1L, L1K, L1J, L1I, L1H, L1G (back), and L1F … L1A (front, Category 3).

### Leazes–East corner (model SE)
- Back: E, D, C, B, A; front: J, H, G, F (letters as printed; exact order around the curve to be confirmed on a larger print).

### East Stand (model S), left = Gallowgate end, right = Leazes end
- **Front (Category 1):** F, E, D, C, B, A.
- **Back (Category 1):** M, L, K, J, I, H. (No G printed.)

### Strawberry Corner, East–Gallowgate (model SW)
- A, B, C, D, E, F; several marked safe standing (the South East Corner standing area).

### Gallowgate Stand (model W), left = Milburn end, right = East Stand end
Four bands, front to back:
- **Front:** E, D, C, B, A.
- **Second:** J, I, H, G, F.
- **Third:** Q, P, N, M, L, K (no O).
- **Back:** V, U, T, S, R.

### Gallowgate–Milburn corner (model NW)
- A, B, C, D, E; The Rooftops with Fenwick (hospitality) at the back.

## Rows and seat numbers (fan photo tags, 2026-11-26)

From the block, row and seat tags on A View From My Seat. "Rows" is the furthest-back row seen in
each block, so the real count can be a little higher. Photos were not copied; only the tags.

- **No I or O rows.** In 362 tags, I appears once (one Platinum Club photo) and O never, while H
  and J appear 10–15 times each. So rows run A–H, J–N, P–Z: row Y is the 23rd row.
- **Doubled letters at the front.** The lowest parts use AA, BB, CC...: Milburn L1 (AA–NN, 13
  rows), Leazes L1 (AA–FF in the front blocks, GG–MM in the blocks behind: one run of 12 rows),
  the Gallowgate lower blocks A–J (AA–JJ seen), the Leazes–East corner front blocks F–J (AA–MM),
  and Gallowgate–Milburn corner block A (KK). Everything else uses single letters from A.
- **Corner prefixes:** LWC (Leazes West Corner, the Milburn–Leazes corner, which matches the
  club's "Leazes West Corner Blocks L7C, L7D and L7E"), LEC (Leazes East Corner), GEC (Gallowgate
  East Corner, Strawberry Corner) and GWC (Gallowgate West Corner, the Gallowgate–Milburn corner).
- **Level 7:** L7 rows to Y in the Milburn and Leazes Stands (23 rows); LL7 rows A–E (5 rows);
  Leazes L6 rows to C (3 rows). So Level 7 is about 28 rows deep in the Milburn Stand and 31 in the
  Leazes End. A fan in LS-L7H mentions 186 steps up to row W.
- **Leazes lower levels:** L1 12 rows (AA–MM), L2 rows to X (22), L4 rows to S (17): about 51
  rows below Level 7.
- **Milburn lower levels:** L1 13 rows (AA–NN); LL2 rows to M (one W); L2 and L4 tags mix single
  and doubled letters (A–P and CC–UU), so their scheme is unclear.
- **East Stand:** blocks A–F rows to R (16), blocks H–M rows to W (21). The tags call H–M the
  East Stand Upper. Both start at A.
- **Gallowgate:** upper blocks R–V rows to U (19; a fan calls GS-V row U the back row), K–Q seen
  to H; lower blocks seen to JJ. Strawberry Corner (GEC) rows to U; Gallowgate–Milburn corner
  (GWC) B–E rows to Y.
- **Seat numbers run along the whole stand, right to left** as seen from the seat. Milburn L1
  runs from about 1 in L1A to about 222 in L1I; Leazes L2 from L2M to L2S; Leazes L4 from 1 in
  L4T. East Stand A–F and H–M are numbered separately, each from about 1 at the Leazes end.
  **Level 7 is one run round the corner:** about 1 in Milburn L7A, about 200 in Milburn L7G,
  about 250–400 through the Leazes West Corner, and about 400–566 across the Leazes L7 blocks.

## Applied to the model (2026-11-26)

- Every block above is a section, named with the stand prefix fans and ticket sites use (MS,
  LS, ES, GS, LWC, LEC, GEC, GWC), in bands where the map stacks them. Leazes–East corner H and J
  are placed side by side.
- Away crowd: all 12 straight Leazes Level 7 blocks (LL7F–LL7M, L7F–L7M).
- Screens: Gallowgate End, Strawberry Corner, Leazes End. The Milburn screen was removed.
- Capacity: model 53,804 (was 52,162), against the club's 52,719. The real blocks are wider than the old
  generated sections, so there are fewer aisles.

## Applied to the model: rows and seat numbers (2026-11-26)

- Rows per band from the furthest-back row tagged in fan photos; lettering skips I and O and
  doubles at the front of the lowest levels; seats numbered right to left along each band, Level
  7 in one run from Milburn L7A round to Leazes L7M.
- Milburn/Leazes tiers re-shaped to those rows: lower tier 51 rows (16° rake, 20 mm sightline
  target), Level 7 28 rows (31 in the Leazes End with L6 in front), hanging about 16 m out over
  the lower tier with a sloped underside. Real Leazes L7 row F sits where the photo fit put the
  camera (92.6 m out, eye 28 m up).
- Leazes West Corner: lower tier starts 12 rows back (it has no L1 blocks), an inference.
- Capacity: model 53,317, against the club's 52,719.
- Not yet matched: East Stand (37 rows tagged, 28 modelled), Gallowgate West Corner back blocks
  (38 modelled, tags to Y), Milburn L2/L4 lettering, Level 7 seats per row about 15% short.

## What this meant for the model (before the blocks were applied)

- **Away fans:** the official map marks the **whole straight Leazes Level 7** (L7F–L7M with LL7F–LL7M) as Visiting Supporters, running from the singing section by the Milburn corner to the East Stand end. The model's six Leazes upper sections (201–206) match those six blocks; it currently marks only the three at the East Stand end. The usual league allocation (up to about 3,000) is smaller than the area, so part may be left empty or used as segregation.
- **Screens:** Gallowgate confirmed by the club (minutes); Strawberry Corner and the Leazes replacement from press reports of the same meeting. **No source for a Milburn screen.** Sizes, heights and whether "outward" means facing the pitch are unknown. The club also mentions four in-bowl replay screens, positions unknown.
- **Capacity:** 52,719 (club, Aug 2026). Model: 52,162.
- **Tiers:** Milburn and Leazes have more levels than the model's two tiers (L1; LL2/L2 and L3 hospitality; L4; L6 Park Grill; LL7/L7). Gallowgate has four bands of blocks; the model has a front part and a back part.
- **Block counts vs model sections:** Milburn L1 8 (model 9), Milburn L7 8 (model 9), Leazes L7 6 (model 6), East 6 front + 6 back (model 8, one tier), Gallowgate 5 + 5 + 6 + 5 (model 6 per tier).

## Still unknown
- **Upper-tier overhang:** no plan, section drawing or dimension found. Next place to look: Newcastle City Council's planning portal (applications for the 1990s–2000 Milburn/Leazes expansion).
  Tried 2026-11-26: the old portal host (publicaccess.newcastle.gov.uk) no longer exists, and
  the council's servers (newcastle.gov.uk, new.newcastle.gov.uk) didn't answer from outside the
  UK, though gov.uk did. Third-party planning mirrors only list recent applications. Background
  found: the Milburn/Leazes tier and roof were built June 1998 – August 2000 (contractor Ballast
  Wiltshier, engineer WSP), and the cantilever roof is about 64.5 m long; that is its length, not
  the tier overhang. Other places for drawings: Tyne and Wear Archives, WSP project notes.
- Screen sizes and exact positions.
- Row counts for the blocks no tagged photo reaches the back of (the counts used are minimums).
