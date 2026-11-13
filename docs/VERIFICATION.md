# Verification report

What was checked, how, and what the numbers were. Run on 2026-11-13.

**Machine:** Windows 11 laptop, Intel Iris Xe (integrated) GPU, through ANGLE/Direct3D 11 in Chromium.
**Build:** three 0.187, Vite 8, TypeScript 7. Stadium: 120 sections, 54,448 seats, 34,963 sold (64%).

## Screenshots

All in [`screenshots/`](screenshots/). Desktop shots are 1280×800 captures of the 3D canvas (no UI). Phone shots are 375×812 captures of the whole page.

| File | View |
|---|---|
| `orbit.jpg`, `orbit-evening.jpg` | Overview, day and evening |
| `seat-lower-corner-110-R06.jpg` | Lower tier, corner section 110, row 6 |
| `seat-upper-sideline-324-R14.jpg` | Upper tier, sideline section 324, row 14 |
| `seat-upper-back-row-324-R22-roof.jpg` | Upper tier back row: roof edge and lights cut across the top of the view |
| `seat-upper-back-row-324-R22-evening.jpg` | Same seat, evening |
| `section-214.jpg` | Section view (middle tier, behind the goal) |
| `mobile-seat-view.jpg`, `mobile-overview.jpg` | Phone layout: seat view with folded bottom sheet; overview with sheet open |

Visual check: in every seat view the pitch is fully visible. Nothing in the stands or roof cuts through the view. The roof only clips the sky above the far stand from the upper rows, which is intended.

## Geometry checks (scripted, every seat)

Run in the browser against the loaded `stadium.json`:

| Check | Result |
|---|---|
| Seat-view eye above the floor under it | 1.20 m for all 54,448 seats |
| Eye below the roof underside | ≥ 5.32 m headroom (worst: S-340-R22-N47) |
| Closest front row to the pitch | 6.69 m (corners); 8 m sidelines, 9 m ends |
| Sightline over the head in front (C-value, to the nearest point of the pitch) | min 84 mm, 5th percentile 90 mm, median 115 mm; **0 seats below 60 mm** |
| Row 1 sightline over its own front wall | lower tier ≥ 0.62 m, middle ≥ 0.15 m, upper ≥ 0.12 m |
| Upper back row (324 R22) | eye 32.3 m above the pitch; roof edge 13° above horizontal, pitch centre 17.5° below |

For reference, stadium design guidance treats a C-value of 60 mm as acceptable, 90 mm as good and 120 mm as excellent.

C-value by tier and zone (mm, minimum / median):

| | Sideline | End | Corner |
|---|---|---|---|
| Lower | 114 / 124 | 127 / 141 | 84 / 107 |
| Middle | 109 / 112 | 120 / 125 | 86 / 99 |
| Upper | 102 / 111 | 110 / 121 | 85 / 103 |

**This check found two real problems, both fixed:**
1. With a constant 20° lower-tier rake, lower-tier sightlines were poor: median 35 mm, 10% of seats below −34 mm, worst −168 mm. Many fans would have had heads blocking the near touchline. Risers are now sized row by row from a 90 mm target, giving rakes of 24°→31° lower, 31°→32° middle and 34°→35° upper.
2. The 22 m corner radius brought the corner front row to within 2.9 m of the corner flag. No rake can fix sightlines that close, and it is unrealistic anyway. The radius is now 14 m, which gives 6.2 m.

## Camera never inside geometry

- **Flights:** 240 animated camera moves were stepped frame by frame, 11,223 frames in all. They covered overview → seat, section → seat, seat → overview, and one-seat hops left, right, back and forward, for seats spread across all 120 sections. At every frame the camera was tested against:
  - the stand surface (at least 0.3 m above it)
  - the roof slab including its girders
  - the concourse block behind the top tier

  **0 violations.** The lowest the camera came to the stands was 1.2 m, at the seat eye position itself.
- **Orbit camera:** 96 tries forcing the orbit camera low into the stands and roof from all sides: 0 violations. The camera is lifted over the building.
- **Limits of this check:** it tests the camera against a simplified model of the building (the stepped floor, the roof slab, the concourse block), not against the actual triangles. The low wall at the front of each tier is not in that model. One-seat hops arc upwards by design to clear it, but that is by construction, not measured.

## Performance

**Status: 60 fps on High in every tested view, at window sizes up to 1920×1080**, on an Intel Iris Xe with a 60 Hz display at 125% scaling. At the full-HD size this relies on adaptive resolution (below).

Measured live in a visible browser window: the app's own render loop running, frame rate taken from `requestAnimationFrame` over 4 s per view (`__stadium.benchmark()`), and GPU time from WebGL timer queries wrapped around the live frames. An earlier attempt with the browser pane hidden gave meaningless numbers: Chromium throttled the hidden page to 2–30 frames per second and deprioritised its GPU work. Those results were discarded.

**1280×800 window** (canvas 1175×940 device pixels, pixel ratio 1.25):

| View, High | fps (avg) | Worst frame | GPU ms/frame (median / p95) |
|---|---|---|---|
| Overview | 60 | 18 ms | 13.0 / 13.2 |
| Section 214 | 60 | 18 ms | — |
| Seat 110 R6, lower corner | 60 | 18 ms | 11.4 / 11.5 |
| Seat 324 R14, upper sideline | 60 | 18 ms | 12.0 / 12.2 |
| Seat 324 R22, back row under roof | 60 | 18 ms | 12.1 / 12.2 |
| Seat 324 R22, evening | 60 | 17 ms | — |
| Fly-in overview → seat, and seat → overview | 60 | 18 ms | — |
| Switching Day/Evening and Low/High | 60 | 18 ms | — |

A worst frame of 17–18 ms is normal timing jitter around the 16.7 ms frame interval, not a dropped frame. GPU headroom is about 4–5 ms per frame.

**1920×1080 window** (canvas 1975×1290 device pixels at full resolution):

| View | Before adaptive resolution | With adaptive resolution |
|---|---|---|
| High, overview | 60 fps (GPU 11.2 ms) | 60 fps |
| High, lower corner | 60 fps (GPU 12.1 ms) | 60 fps |
| High, upper sideline 324 R14 | **46 fps** (GPU 18.3 ms) | **60 fps** after about 4 s, at 76% resolution |
| High, back row 324 R22 (day and evening) | — | 60 fps |
| Low, upper sideline and overview | 60 fps (GPU 11–12 ms) | 60 fps |

**Adaptive resolution** ([`src/scene/quality.ts`](../src/scene/quality.ts)) was added after the full-HD measurement showed 46 fps, then tuned during the larger-window tests below:
- It watches a smoothed (~1 s) frame rate. If that stays under 58 fps for 1.5 s, it renders at 0.15× lower pixel ratio.
- After each change it waits 1 s before judging again. Without that wait it overshot, stepping one level lower than needed.
- **Floor:** 0.7× on ordinary windows. On very large windows it may go lower, but never below 1100 rendered pixels of height (about 1080p sharpness) and never below 0.5×.
- After 8 s steady at 59 fps or more, it tries one step of 0.1× back up. If a step back up has to be undone, the wait before the next try doubles, up to 2 minutes, so it cannot oscillate.
- While resolution is reduced, the fps readout shows it, for example "60 fps · 76% res".

At 1920×1080 the upper-tier seat went 1.25× → 1.10× → 0.95× and held 60 fps. Back in the overview it climbed back to the full 1.25× within about 15 s and stayed at 60 fps with no oscillation.

**Larger windows and high-DPI loads** (tested afterwards; time to settle in brackets):

| Window, High | Overview | Lower corner 110 R6 | Upper sideline 324 R14 | Back row 324 R22 |
|---|---|---|---|---|
| 2560×1440 | 60 fps at 0.70× | 60 at 0.70× | **60 at 0.70×** (≈13 s) | 60 at 0.70× (day and evening) |
| 3840×2160 (4K) | 60 at 0.70× | 50 at 0.70×\* | **≈53 at 0.52×**, the floor (≈12 s) | — |
| 1440×900 at 1.5× (≈ a 2880×1800 laptop panel) | — | — | 60 at 1.20× (≈5 s) | — |
| 1920×1080 at 1.5× (≈ a 4K laptop at 200%) | — | — | — | 60 at 0.90× (≈12 s) |

\* Measured before the floor was made size-dependent, so it was stuck at 0.7×; it would now go lower.

- At 4K, Low holds 60 fps in the upper sideline view (at 0.52×). **On this GPU, High at a full-screen 4K window does not reach 60 fps** in upper-tier seat views; it settles around 53.
- The high-DPI rows force High's 1.5× pixel-ratio cap, which matches the pixel count of those screens. Real high-DPI displays themselves weren't available to test.
- At 2560×1440, these were measured before settling on resolution as the lever:

  | Change | fps |
  |---|---|
  | All crowd figures at the cheap far detail level | 53 |
  | Shadows off | 59 |
  | 0.7× resolution | 60 |

  So this view is limited by how many pixels are drawn, not by geometry. Lowering resolution was chosen over turning shadows off automatically, which would make the lighting visibly pop.
- 1280×800 re-checked after these changes: still full resolution and 60 fps, so nothing is reduced when it doesn't need to be.

Not measured: high-refresh displays (120 Hz and above), other GPUs, real high-DPI screens, other browsers, and real phones (phones were only emulated at 375×812). Adaptive resolution aims for 60 fps; on a 120/144 Hz display it treats 60 fps and above as good enough and won't try to reach the display's full rate.

To measure on your own machine: run `npm run dev`, open a seat, keep the tab in front, and run `await __stadium.benchmark(5)` in the browser console.

## Keyboard-only use

Tested with real Tab, Shift+Tab, arrow, Enter and Esc key presses, logging where focus went.

- **Tab order (overview):**
  1. Day/Evening, then Low/High (each group is one tab stop; arrow keys switch within it)
  2. Section dropdown (Row and Seat are skipped until a section is chosen)
  3. The four price-category checkboxes
  4. Min and max price sliders
  5. Reset filters, Section labels, Controls

  Every stop shows the focus ring.
- **Tab order (seat view):** after the switches come Back to overview, then ◀ ▲ ▼ ▶, Field of view, Recentre, then the panel.
- **Picking a seat by keyboard:** Section → Row → Seat dropdowns flew into the seat (`S-103-R05-N05`), with focus staying on the Seat dropdown.
- **Seat buttons:** Enter on ▶ moved to the next free seat (N05 → N20, skipping sold seats), with focus staying on ▶. Enter on Back returned to the overview.
- **Accessible names:** checked as a screen reader would compute them (aria-hidden content excluded). Every control has a clean name, for example "A · Premium €145, 1,468 seats free", "Min price €40", "Seat".

**Found and fixed:**
1. **Esc did nothing while focus was in a dropdown**, which is exactly where keyboard users are after picking a seat. Esc now always returns to the overview. An open dropdown still uses the first Esc to close itself (tested: first Esc closed the list, second returned to the overview).
2. **Focus was lost after leaving a seat view.** The Row/Seat dropdowns become disabled and the Back button and seat toolbar hide, so whichever of them had focus dropped it to the page body. Focus now moves to the Section dropdown. Tested from both Esc-in-dropdown and Enter-on-Back, with the focus ring visible.

**Not tested:** an actual screen reader (NVDA, VoiceOver) reading the page aloud.

## Colour contrast

Every visible text element (94 distinct text styles, with the seat view, selected-seat card and "Your seat" card all on screen) was measured against its real background using the WCAG formula. Where text sits on a translucent panel over the 3D view, it was measured against both a white and a black scene behind.

- **Result: 0 failures** at WCAG AA (4.5:1 normal text, 3:1 large text). The lowest regular text is the panel labels at 7.2:1.
- **Computed separately** for states not on screen during the scan, all against a white scene behind:

  | Element | Contrast |
  |---|---|
  | Tooltip text | 14.0:1 |
  | Tooltip secondary text | 7.8:1 |
  | Sold / Available status | 9.3:1 / 12.0:1 |
  | Hint bubble | 7.3:1 |
  | Red "no free seat" notice | 7.0:1 |

- **Focus ring** (yellow) vs the dark panels: 12:1. Against the green "Select seat" button it would only be 1.3:1, but the ring is drawn 2 px outside the button, on the dark card, so it remains visible.

**Found and fixed:** the black category letter on the patterned badges could land on a pattern line. Worst case was 3.4:1 on D's crosshatch; B and C were borderline at about 4.7–4.8:1. Each patterned badge now has a solid disc of its colour under the letter, so the letter is always on plain colour (B 9.3:1, C 9.1:1, D 6.1:1, A 5.4:1). The patterns still show around the disc.

The 3D seat colours themselves are not text and were not measured. Price categories are never shown by colour alone: there are letters on the badges and the floating section tags, and words in the tooltip and seat card.

## What is approximate or not realistic yet

**Stadium model**
- The bowl is a rounded rectangle with constant-depth rows. Real bowls vary row depth and section shapes, and have vomitories (tunnel entrances), stairs and handrails. None of those exist here; aisles are just gaps between seat blocks.
- One generic roof ring and a plain facade. No scoreboards, no corner gaps, no players' tunnel or dugouts.
- Sightline checks use the standard simplification: everyone's eye 1.2 m above their floor, aimed at the nearest point of the pitch. Taller people in front, standing fans and safety rails are not modelled.

**Crowd and lighting**
- The crowd is low-poly box torsos with simple heads, all seated and still, in random shirt colours. No team colours (deliberately generic).
- Evening lighting is faked: one overhead light plus four corner spotlights stand in for the roof floodlights, and the outside of the building is simply darkened. Only the one directional light casts shadows.
- Shadows are soft but coarse: about 15 cm per shadow-map pixel, so small details like seat backs get blurry shadows.

**Seat view**
- Every seat initially looks at the centre spot. Ticket sites often aim each seat at the nearest part of the pitch instead.
- Portrait phones widen the vertical field of view (up to 105°) so the whole pitch width fits. That gives some edge distortion.

**Tickets**
- One price per section: front and back rows in a section cost the same. With only four prices, the min/max price filter effectively includes or excludes whole categories.
- Availability is random but clustered in runs along each row. "Select seat" only keeps the seat in memory for this session; there is no checkout.

**Verification itself**
- Screenshots were captured from a hidden browser pane via scripted renders, not by watching the live app. Frame rates were measured afterwards with the pane visible.
- Performance was measured on one machine only (Iris Xe, 60 Hz).
- On large windows, High holds 60 fps partly by lowering resolution, so the picture is softer there. At a full-screen 4K window it settles around 53 fps on this GPU.
- Larger windows and high-DPI loads were emulated in the browser pane, not tested on real monitors.
