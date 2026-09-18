# RisingAmp brand assets

Generated geometry, not traced. Every curve is a real circular arc and the two
halves are exact mirrors. Rebuild with `python3 src/build.py .` (needs
`fonttools` and Poppins installed locally).

## The mark

**Mark A** is the chosen cut: the original silhouette, rebuilt from measurement.
Nothing rises above the dome. Three alternates were explored and set aside; they
stay in the folder as `risingamp-alt-*.svg` in case they are ever wanted.

## Which file to use

| Use | File |
| --- | --- |
| Anywhere the logo appears with type | `risingamp-lockup-horizontal.svg` |
| Tight vertical space | `risingamp-lockup-stacked.svg` |
| Mark alone, 48px and up | `risingamp-mark-primary.svg` |
| Mark alone, below 48px | `risingamp-icon.svg` |
| App icon | `risingamp-appicon-dark.svg` |
| Browser tab | `favicon.svg` |

The icon cut is Mark A redrawn for a smaller space, not the logo scaled down:
narrower stance, heavier stroke, canopy raised and widened until it just meets
both legs. No ferrule, no flicked tips, nothing above the dome. Below about 32px
the logo cut loses the umbrella entirely, so do not substitute one for the other.

## Geometry of Mark A

| | |
| --- | --- |
| Overall ratio | 1 : 1.33 |
| Leg angle | 35.25 degrees from vertical |
| Stroke at apex | 0.112 H, perpendicular |
| Stroke at foot | 0.093 H, a 17% taper |
| Canopy span | 0.59 H tip to tip |
| Dome depth | 0.17 H |
| Apex radius | 0.047 H, outer corner only |
| Stem overshoot | 0.08 H below the feet, as originally drawn |

H is the mark's height. Every value is proportional, so the mark redraws at any
size without being redrawn. To pull the stem flush with the feet, change
`bot_y` in `variant_true()` from 445 to 419 and rebuild.

## Colour

| Role | Hex | Notes |
| --- | --- | --- |
| Ink | `#14161C` | primary, mark and type |
| Paper | `#F4EFEA` | ground, warm not white |
| Gamp Green | `#2C5A58` | the single accent, on light grounds |
| Gamp Light | `#6BA69E` | accent on dark grounds (2C5A58 hits 2.3:1 on ink and fails) |

Navy `#1A2340`, Rust `#955D3D` and Violet `#585482` are retired as logo colours.
They span L* 14 to 45 alongside the teal, too wide to read as one family. They
are useful as chart category colours instead.

## Typography

Poppins. Regular for "Rising", Bold for "Amp", tracking -0.012em.
Mark height is 1.46x cap height, gap is 0.52x cap height.
All lockup files have the type outlined, so no font install is needed to open them.
`risingamp-lockup-horizontal-light.svg` is the Light + Bold pairing from the
original mockup, kept for reference.

## Clear space and minimums

Clear space on all four sides equals half the mark's height.
Minimum sizes: logo cut 48px tall, icon cut 16px.
