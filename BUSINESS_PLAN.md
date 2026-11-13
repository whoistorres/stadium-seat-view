# Stadium Seat View: Business Plan (draft)

A plan for turning the Stadium Seat View prototype into a business that sells seat-view previews to football clubs and ticketing platforms. Status: **plan only, nothing built yet**. For the prototype itself, see [PROJECT.md](PROJECT.md).

---

## 0. Honest starting point

- **Niche but real market.** Competitors already exist:
  - 3D venue vendors (for example 3D Digital Venue, IOMEDIA)
  - ticketing platforms' own seat-view features
  - 360° photo vendors
  - free fan seat-photo sites
- **The 3D viewer alone is easy to copy.** What is hard to copy:
  - accurate models of real venues
  - integrations with ticketing platforms
  - a customer list
  - how fast you can onboard a new venue
- **Club sales cycles run 6–18 months**, timed around season-ticket renewals and stadium projects.
- **"All in" means full focus with kill criteria, not spending savings on day one.** Keep your income until a paid pilot is signed.

---

## 1. Pick one wedge

1. **First customer: a club building or renovating a stand.** Fans have to buy seats in a stand that doesn't exist yet, so the need is urgent. The money comes from the stadium project's marketing or sales budget, not the day-to-day ticketing budget.
2. **Second: hospitality and premium sales teams.** High price per seat, where seeing the view helps close the sale.
3. **Distribution later: a ticketing platform partnership**, once there is proof.
4. **Side market to explore: stadium architects and sightline consultants.** The sightline engine (C-value clearance for every seat) and the seat views help them design stands. They are also a channel to clubs, since they hear about new builds early.

Stay with football until there are two paying customers. Then expand to rugby, other sports and arenas. Concert venues are harder, because the layout changes per event.

---

## 2. Validation (weeks 0–10)

- Hold 25–30 discovery calls with:
  - Heads of ticketing and hospitality at clubs
  - stadium project managers
  - partner managers at ticketing platforms
  - stadium architects
- Ask:
  - How do you show seat views today, and what does it cost?
  - Do complaints or refunds about seat views happen? How often?
  - Who signs off on a purchase like this, and from which budget?
  - When is your next stadium project or renewal window?
- **Demo:** model one real stadium from public plans as a **private** pitch to that club only. Never publish a famous stadium, its crest or its branding without permission (trademark and architectural copyright risk).
- **Goal:** 3 or more letters of intent, or 1 paid pilot.
- **Kill or pivot rule:** if nothing is paid or committed by about month 4, either pivot (to the architects market, or the seat-image API only) or stop.

---

## 3. Product milestones

1. **Months 1–3: core**
   - **Seat-image API:** one pre-rendered view image per seat, served by URL. The easiest thing for a platform to adopt.
   - **Embeddable viewer:** a `createSeatView(container, options)` entry point, events sent out to the host page, and styles that don't leak into it.
   - **Plug-in data adapter** in place of the fixed `tickets.json`.
   - **Seat-ID mapping tool**, matching the platform's seat labels to ours, with checks for mismatches.
   - **Per-seat prices and attributes:** wheelchair space, companion seat, restricted view and similar.
   - **Fallback:** show the static image if 3D fails.
2. **Months 3–6: first real venue**
   - Import from architects' files (CAD or building-model formats) or a laser scan, plus the club's seat manifest.
   - A QA report per venue: seat counts against the manifest, sightlines, comparison with photos from real seats.
   - Delivered as the paid pilot.
3. **Months 6–9: first ticketing platform**
   - An adapter against one platform's test environment. In European football that is likely SECUTIX, Ticketmaster Sport or Eventim, depending on which platform the pilot club uses.
4. **Months 6–12: hardening**
   - speed on real phones, and iOS Safari support
   - a WCAG 2.2 accessibility audit and a VPAT (accessibility conformance report)
   - a penetration test
   - a data processing agreement and GDPR posture
   - monitoring and an uptime commitment
5. **Year 2**
   - venue onboarding cut from weeks to days
   - an analytics dashboard
   - SOC 2 or ISO 27001 certification, if enterprise buyers demand it

**Rule:** no visual polish beyond "good enough" until customers ask for it. The money is in accuracy and integration, not prettier crowds.

---

## 4. Company setup

- A limited company in your country (UK Ltd or the local equivalent), and an accountant from the start.
- **Intellectual property:**
  - assign all code to the company
  - check the licences of what the code depends on (three.js is MIT, which is fine)
  - have every contractor sign an agreement assigning their work to the company
- **Name:** choose a brandable one. "Stadium Seat View" is too generic to trademark. Check trademarks and domain names before committing.
- **Contract templates:** NDA, master services agreement, data processing agreement, pilot agreement.
- **In every customer contract, spell out:**
  - who owns the venue model (the club, you, or licensed back)
  - that you have the right to use the club's marks and the building's likeness
- **Insurance:** professional indemnity, plus cyber insurance once integrated with platforms.

---

## 5. Team

- **Key hire or co-founder: a sales and partnerships person with a network in sports ticketing.** Clubs buy from people they trust, and this can't be skipped.
- **Engineering:**
  - integration and backend work: adapters, APIs, the CDN, security
  - 3D and graphics work: the founder, or a contractor
- **Per-venue contractors:** laser-scan survey firms and 3D modellers. Get quotes early: this is the cost of every venue sold.
- **Advisors:** a former Head of Ticketing at a club, and someone from inside a ticketing platform. Small equity stakes.

---

## 6. Money

**Costs to price early.** Get real quotes for each:
- venue survey and modelling, per venue
- penetration test
- accessibility audit
- legal templates
- insurance
- CDN and hosting (low, because the site is static)
- SOC 2, later

**Pricing hypothesis to test in discovery:** a one-off setup fee per venue plus an annual licence. Later, possibly a platform-wide licence with per-venue onboarding fees. Set the actual numbers from what discovery calls reveal.

**Funding, in this order:**
1. **Paid pilots:** money that doesn't cost equity, and proof the product works.
2. **Grants and accelerators:** innovation grants in your country, sports-tech accelerators (for example HYPE Sports Innovation), and club innovation programmes.
3. **Angel or seed investment** only after one paying club and a platform conversation, which gets much better terms.

---

## 7. Go-to-market

- **Direct outreach** through LinkedIn and warm introductions to Heads of Ticketing and hospitality at clubs with stadium projects coming up. Industry press lists planned builds.
- **Events:** stadium-industry and ticketing-industry conferences (for example TheStadiumBusiness Summit, and INTIX for ticketing in the US). Go there to book meetings, not to buy booths.
- **Architects** as both a sales channel and a partner.
- **Case study after the pilot,** with before/after numbers on conversion, upgrades and complaints. Without numbers, platforms won't move.
- **Approach a ticketing platform only once a club on that platform is already a customer.** That club asking for you is the best way in.

---

## 8. Competitive advantage (what is hard to copy)

- **Venue library:** every onboarded stadium adds value and would be costly for a competitor to rebuild.
- **Onboarding tools:** fast import, seat-ID mapping and QA, so each new venue is cheaper for us than for a competitor.
- **Integrations** with ticketing platforms.
- **Engagement data:** which seat views lead to purchases, aggregated and anonymised.

---

## 9. Main risks and mitigations

| Risk | Mitigation |
|---|---|
| A ticketing platform builds its own | Be its supplier rather than its competitor: the seat-image API and venue models |
| Long sales cycles | Time outreach around stadium projects and the renewal calendar; keep your income during validation |
| Dependence on one platform | Keep data adapters for several platforms |
| Disputes over IP and rights | Rights clauses in every contract; never publish a venue without permission |
| Over-building | Kill criteria; build only features customers ask for |
| Running out of money | Pilots fund the next steps; no big hires before revenue |

---

## 10. Timeline

- **Weeks 0–2:** set up the company and check the name, build the list of people to call, write a pitch deck, build a private demo of one target stadium.
- **Weeks 2–10:** 25–30 discovery calls, refine pricing, secure letters of intent or a pilot.
- **Months 3–6:** build the core (section 3, step 1) while delivering the first paid pilot venue; find a sales co-founder or advisor.
- **Months 6–9:** pilot results and case study, one platform adapter, security and accessibility audits.
- **Months 9–12:** clubs 2–3, partnership talks with a platform, a seed round if the numbers support it.

**Decision points:**
- **Month 4:** no committed customer → pivot or stop.
- **Month 9:** the pilot shows no measurable benefit → rethink the wedge.

**First concrete step:** write the discovery-call script and list 30 names: clubs with stadium projects, Heads of Ticketing, platform partner managers and architects. It costs nothing and shows whether to go deeper.

---

## Appendix A: What a ticketing platform needs from the product

A platform will not replace its own seat map. It will add a seat view next to it, if that is cheap to integrate, safe and fast.

### Three levels of integration, easiest first

1. **Seat-view images by URL.** One image per seat, for example `cdn/.../venues/{venueId}/seats/{seatId}.jpg`. The platform only adds an image tag. Integration takes days, and the images also work in emails, apps, search results and on low-end phones.
2. **Embeddable viewer.** A "View from seat" button on the platform's own map opens the 3D view for one seat, as an iframe or a web component (`<seat-view venue="x" seat="S-214-R12-N07">`). No ticketing data needed.
3. **Full interactive map with live availability.** The fan picks a seat in 3D, the selection is sent back to the platform, and the platform's own checkout completes the purchase. Highest value, highest integration cost.

Sell level 1, upsell to level 2, and offer level 3 only to deep partners.

### Changes needed in the current prototype

- **It assumes it owns the whole page.** It uses fixed element IDs (`#panel`, `#viewport`, `#hud`), global CSS, and a single instance. Needed:
  - one entry point that creates a self-contained instance
  - styles isolated with Shadow DOM
  - support for several viewers on one page
- **No events out.** Selection only changes internal state. Needed:
  - `seatHover`, `seatSelect` and `viewOpened` events
  - inside an iframe, `postMessage` with a strict check of which site may send and receive messages
- **The host page can't control it.** Needed: methods such as `showSeat(id)`, `setInventory()`, `setTheme()`, `setLocale()` and `destroy()`.
- **Data is baked in at build time.** Needed: venue data loaded from a CDN by venue ID and version.
- **The debug hook `window.__stadium`** must stay out of production builds.
- **Bundle size.** Currently about 670 KB of JavaScript plus 1.9 MB of JSON. Needed:
  - load three.js only when the 3D view opens
  - a compressed binary seat format
  - load each section's data only when it's needed

  Target: under about 300 KB before the first view appears.
- **No fallback.** Needed: show the static image if WebGL fails or the graphics context is lost. The platform's checkout must never break because of the viewer.

### Ticketing data, modelled the way platforms work

- **Seat-ID mapping.** Every platform has its own venue "manifest" with its own section, row and seat labels. A mapping table between their IDs and ours, plus reports of mismatches, duplicates and renumbering, is the core integration work, and part of what is being sold.
- **Plug-in data adapters** (`getPriceLevels()`, `getAvailability()`, `subscribe(onChange)`), one per platform. The 3D core never changes.
- **Richer seat data:** price per seat, price types (adult, child, member), fees and dynamic pricing.
- **Seat attributes:** wheelchair space, companion seat, restricted view, aisle, family zone, away section. Shown in 3D and usable as filters.
- **Live updates:** the platform owns holds and sales; the viewer only displays them. Fan the platform's feed out through our own cache or edge layer, so fans don't hit the platform's API directly, especially when tickets go on sale.
- **Venue configurations:** football and concert layouts, temporary stands, closed sections. Venue data versioned per configuration and per event.

### Venue onboarding pipeline

- **Inputs:** CAD or building-model files from architects, laser scans of the venue, and the platform's manifest CSV. Extend the existing CSV converter into a proper import tool.
- **Building model:** a real compressed 3D model file of the stadium (glTF/GLB) with detail levels, replacing the generic one. Camera clearance has to work against this real model.
- **Automatic checks and a QA report per venue:** seat counts against the manifest, sightline clearance for every seat, roof and camera clearance, and comparison with photos from a sample of real seats.
- **Key number:** time to onboard a venue. Aim for days, not months.

### What platform procurement will check

- **Performance:** fast on mid-range Android phones over 4G, with a first view in under about 2 s.
- **Accessibility:** a WCAG 2.2 AA audit and a VPAT. The EU Accessibility Act makes this mandatory for ticket sales in the EU.
- **Security:**
  - a strict Content Security Policy and no `eval`
  - integrity checks on scripts, and a sandboxed iframe
  - dependency scanning and a penetration test
  - later, SOC 2 or ISO 27001 certification
- **Privacy:** no cookies by default, analytics only with the platform's consent, a data processing agreement. The viewer never touches personal or payment data, which is a selling point.
- **Reliability:** an uptime commitment of 99.9%, a status page, monitoring and a fallback.
- **Browser support:** iOS Safari above all. Handle the graphics context being lost.
- **Localisation and branding:** multiple languages and currencies, right-to-left support, and theming with the platform's own brand.

The single most valuable first step is the **pre-rendered seat-image API**. It is the cheapest for a platform to adopt, gives a foothold for a partnership, and builds directly on what already exists: the seat data, the camera logic, and the screenshot capture used in testing.
