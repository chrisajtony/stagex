# StageX — site

Static site. No build step, no dependencies. Open `index.html` in a browser, or drop the
whole folder on Netlify / Vercel / S3 / any static host.

```
index.html        one page, ten sections
css/styles.css    design system + layout
js/main.js        reveals, header, frame scrub, menu, form
assets/           images, the hero ident, and Ooops Academy episode 1 (59 MB total,
                  but only ~2.3 MB of it loads before a visitor asks for the rest)
```

## Design system

| Token | Value | Use |
|---|---|---|
| `--black` | `#08090B` | page ground |
| `--graphite` | `#101216` | panels, plates, key art |
| `--bone` | `#F2F1EC` | primary text |
| `--muted` / `--dim` | `#8B909A` / `#5C616B` | body copy, labels |
| `--blue` | `#4DA3FF` | the accent — from the StageX brand kit |
| `--cyan` | `#7DF0E8` | secondary spark, used sparingly |

Type: **Archivo** (variable width + weight) for display and body, **IBM Plex Mono** for
labels, timecode, and metadata. Both load from Google Fonts.

The structural device throughout is production vernacular — scene slugs, slate metadata,
timecode readouts — rather than decorative numbering.

## The motion system

Everything animated runs off **one `requestAnimationFrame` loop** in `main.js` §5. Nothing
polls, nothing fights, and every effect reads the same scroll value — so they stay in sync.

**Inertial scroll.** Wheel input is intercepted and eased toward a target position
(`§4`, ~0.11 lerp). Once the page settles, the loop reads the real scroll position back, so
keyboard, scrollbar dragging, find-in-page and browser scroll-restore all take over cleanly
instead of being fought. Turned off for touch devices — native momentum is better there —
and for `prefers-reduced-motion`.

**The hero is a sticky stage.** `.hero-stage` is 172svh tall and the hero is `position: sticky`
inside it, so the page scrolls *over* the hero rather than pushing it away. Across that span
the hero scales to 0.91, fades out, and blurs to 5px while the reel drifts down — a rack focus
into the first section. Adjust the hold length by changing `.hero-stage { height }`.

**The hero ident.** `assets/hero.mp4` is your StageX sting — 1280x720, 12.8s. It is one
continuous push-in: black until about 0.9s, a blue X emerging in a dark corridor, then a steady
brightening ramp that arrives at a lit corridor with a large centred wordmark and holds there
for the last five seconds.

That shape rules out looping the whole thing. On repeat it would pulse between black and
near-white every 13 seconds, and its wordmark would collide with the headline sitting on top.
So it plays **in full once on arrival** — the whole brand moment — and then loops the window
between `data-loop-start="1.0"` and `data-loop-end="3.8"` on the `<video>`: the dark stretch
where the corridor reads as atmosphere and the X is just a glow. Three things keep the type
clear on top: the video is graded to 85% brightness, a radial veil sits where the wordmark
resolves, and the scrim knocks down the ceiling and floor while leaving the middle band visible.

**One honest caveat about that loop.** The source is a continuous brightening ramp, so no two
points in it match in brightness — every loop window has a visible reset. 1.0–3.8s was chosen
because it is the flattest stretch and it dips slightly darker on the cut rather than flashing
brighter, which is far less distracting on a dark hero. If the reset bothers you:

- **Widen the window** — push `data-loop-end` out toward 5.0 for a longer, slower cycle. The
  reset gets bigger but arrives less often.
- **Never loop at all** — delete the `ended` handler in `main.js` §4b. The sting plays once and
  the video simply stops, leaving the last frame. Note that frame is the bright wordmark one.
- **Loop the whole sting** — remove both `data-loop-*` attributes.

Adjust the grade with `.hero__video { filter: … brightness() }` and the fade over it with
`.hero__scrim { background }`, both in `styles.css` §8.

The video is skipped entirely for `prefers-reduced-motion` and for browsers reporting
Save-Data; `assets/hero-poster.jpg` (a dark frame from the corridor, blue X lit) stands in, and
also covers the gap before the file has loaded. `preload="none"` means it never blocks first
paint.

**Resolution note:** the source is 1280x720, so it is upscaled on large displays. It is dark
and graded down so this reads as softness rather than pixelation, but a 1080p or 4K export
would be sharper.

**The word rotor.** The headline's last line cycles `eyeballs` → `revenue` every 2.4s. This is
a port of the framer-motion `animated-hero` pattern — words stacked absolutely in a masked box,
each springing to `y: 0` when it becomes the active one — but written in vanilla JS against
this codebase rather than pulled in as a React component (see **On the React version** below).
It uses framer's actual spring defaults (stiffness 50, damping 10, mass 1) integrated in the
same rAF loop as everything else, so the feel matches rather than approximating the curve with
an easing.

Words always exit upward and re-enter from below, like a drum. To change the words, edit the
`.rotor__w` spans in `index.html`; add as many as you like. Keep `.rotor__sizer` set to the
*tallest* word — it is the only element in normal flow and it is what gives the line its
height. Cadence is `ROTOR_DWELL` in `main.js` §4a.

The full sentence lives in a `.sr-only` span above the visible lines, and the rotor itself is
`aria-hidden`, so screen readers and search engines get "We build shows that generate eyeballs
— and revenue." as one clean sentence instead of both words jammed together. Under
`prefers-reduced-motion` the words cross-fade in place with no vertical travel.

**The hero tilt.** Moving the pointer across the hero tilts the video plate in 3D toward the
cursor, and pushes it slightly away on enter. This is the `motion-tilt-card` pattern — pointer
position mapped to `rotateX`/`rotateY`, each on framer's stiffness 200 / damping 20 spring —
ported to vanilla and folded into the same rAF loop.

Two changes were needed to take it from a 340px card to a full-bleed background:

- **The angle is 10, not 15.** `MAX_TILT` is the full sweep, so the plate reaches ±5° at the
  screen edges. At viewport scale the reference's 15 reads as a lurch rather than depth.
- **The plate is overscanned.** Tilting a full-screen element swings its far edge inward and
  would show bare background at the corners. `--tilt-scale: 1.12` in `styles.css` §8 covers
  that with room to spare — verified at the extremes with the scrim removed. If you raise
  `MAX_TILT`, raise `--tilt-scale` with it.

Only the plate tilts. The headline and CTA stay flat, so type never skews and stays legible.
The tilt settles back to flat once the hero scrolls away, and is skipped entirely for
`prefers-reduced-motion` and for coarse pointers, where there is no hover to respond to.

**The playhead.** Fixed to the bottom of the viewport: a progress line, one clickable tick per
scene, the current scene name, and a page timecode that treats the whole page as an 11 minute
cut (`RUNTIME` in `main.js`). It appears once you leave the hero. Ticks are generated from the
`data-scene` attribute on each section — add or remove sections and it rebuilds itself.

**Everywhere else.** Headline words roll in individually from a mask with a blur falloff
(`[data-split]`), plates and key art parallax against their frames (`data-par="0.14"` — higher
is more travel), stats count up when they land, the platform marquee speeds up with scroll
velocity, and the header hides on the way down.

All of it collapses to a static page under `prefers-reduced-motion`.

## The frame scrub

The League of Rock card is a real scrubber. Moving the pointer across it steps through nine
episode stills and reports each one's actual timecode, taken from the source filenames.
It also works with the keyboard (focus it, then arrow keys / Home / End) and auto-advances
until someone takes over.

To add scrub frames to another show, drop images in `assets/` and copy the `<figure class="scrub">`
block, giving each `<img>` a `data-tc` attribute. No JS changes needed.

## The episode player

The Ooops Academy card plays the real episode. `assets/oops-ep1.mp4` is a 1280×720 transcode
of your `EP1 .mov` (the original is 1920×1080, 64s, 107 MB — H.264 video with uncompressed PCM
audio, which is what made it so large).

It is **click-to-play with `preload="none"`**, which is the whole reason the file can be this
big: nothing is fetched until someone presses play, so the card costs a passing visitor
nothing. On click the source attaches, native controls appear, and it plays with sound. It
pauses itself if you scroll away mid-playback.

That transcode is 42 MB. The encoder available here (`avconvert`) has no bitrate control, and
its presets jump straight from 640×360 at 18 MB to 1280×720 at 42 MB with nothing usable in
between, so quality won this trade rather than size. Three ways to change that:

- **Trim to a preview** — `avconvert --preset PresetAppleM4VAppleTV --source "EP1 .mov"
  --output preview.mp4 --start 0 --duration 20` gives roughly 13 MB for the first 20 seconds.
- **Encode properly** — with `ffmpeg` you would get 720p at around 1.5 Mbps (~12 MB) with no
  visible loss on animation: `ffmpeg -i "EP1 .mov" -c:v libx264 -crf 23 -vf scale=1280:-2
  -c:a aac -b:a 128k oops-ep1.mp4`.
- **Host it externally** — for a YouTube series, a YouTube or Vimeo embed is arguably the
  right call anyway, and drops the file from your deploy entirely.

`assets/oops-poster.jpg` is the frame shown before playback. Swap it for any other frame if
you would rather open on a wider shot than the close-up.

## Media

Every card in the slate now carries real media:

| Card | Media | Where it lives |
|---|---|---|
| League of Rock | 9 episode stills, pointer-scrubbable | `assets/lor-*.jpg` |
| NutraMedica / NFH | Practitioner testimonials | Bunny Stream `78b92c3d-…` |
| Ooops Academy | Episode 1, click-to-play | `assets/oops-ep1.mp4` |
| It Takes A Village | Concept reel | Bunny Stream `28d4f458-…` |

The two Bunny Stream videos are `<iframe>` embeds rather than the site's own player.
That library has token authentication on — the raw thumbnail and HLS playlist both return
403 — so only Bunny's player can resolve signed URLs at runtime. Both are `loading="lazy"`
with autoplay off, so neither costs anything until scrolled to.

**If a Bunny video fails to play on the live site**, check the library's allowed-referrers
whitelist: it needs to include the domain the site is served from. Turning token auth off
would also let these use the same poster-plus-play-button treatment as the Ooops card.


## Wiring the form

`js/main.js` intercepts the submit and shows a confirmation; nothing is sent anywhere yet.
Pick one:

- **Netlify** — add `name="brief" data-netlify="true"` to the `<form>` and delete the
  `e.preventDefault()` branch in section 7 of `main.js`.
- **Formspree / HubSpot / anything** — set `action="https://…"` and `method="post"` on the
  form, same deletion.
- **Your own endpoint** — replace `form.classList.add('is-sent')` with a `fetch()` POST,
  then add the class on success.

The four qualifying questions are the ones specified in the brief, so unqualified leads
filter themselves out before they reach you.

## Content source

All copy comes from *StageX Overview.pdf*. The audience-compounding graphic in "Why series
win" is an illustrative model of behaviour, labelled as such on the page — it is not
measured data. If you have real retention numbers, that figure is the place to put them.

## Accessibility

Keyboard-navigable throughout with visible focus rings, `prefers-reduced-motion` respected
(all reveals, the grain, the hero crossfade, and the scrub auto-advance switch off), and
every image carries alt text.


## On the React versions

The rotor and the hero tilt were both specified as shadcn/framer-motion components
(`animated-hero.tsx` with `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react`
and a shadcn `Button`; `motion-tilt-card.tsx` with `motion/react`).
This site is static HTML, CSS and vanilla JS — there is no React, no Tailwind, no TypeScript
and no `components/ui` directory — so that component was ported rather than installed.

That was a deliberate call. Introducing React, a bundler, Tailwind and the shadcn CLI to this
project to animate one word would mean rewriting all ten sections as components, replacing a
hand-built 700-line stylesheet with utility classes, and turning a folder you can open by
double-clicking into a project that needs `npm install` and a build step before anyone can
look at it. The motion is about forty lines of JS; the toolchain is not worth it for that.

**If you do move to React later**, both components drop in essentially unchanged:

```bash
npx shadcn@latest init          # creates components/ui and lib/utils
npx shadcn@latest add button
npm i framer-motion lucide-react
```

Components must live in `components/ui` because that is the path the shadcn CLI writes to and
the path its `@/components/ui/button` imports resolve against — put them elsewhere and every
generated component's imports break. Then paste the components in, swapping `animated-hero`'s `titles`
array for `["eyeballs", "revenue"]` and pointing `motion-tilt-card` at the hero plate instead
of its Amsterdam stock photo. The decisions worth carrying over from this build: the accessible
full sentence in a visually-hidden span, the `aria-hidden` on the cycling words, the reduced
angle plus overscan for full-bleed tilting, and reduced-motion branches — none of which the
original components have.
