# Alice Machine entity art

Real **RGBA PNGs** (with transparency). Canva “PNG” downloads are often **JPEG + black background** renamed to `.png` — those cannot store alpha.

## How we fixed it (same class of issue as Bonk Fam portraits)

1. Detect real format by file header (`89 50` = PNG, `FF D8` = JPEG).
2. If JPEG-with-black-bg: convert with **black → transparent** + soft edge.
3. Save as real PNG (`colorType` RGBA).

## Current level assets (clean names)

| Level | File | Entity |
|-------|------|--------|
| 1 | `machine-elf.png` | Machine Elves |
| 2 | `jester.png` | Jesters / Clowns |
| 3 | `mantis.png` | Insectoids / Mantis |
| 4 | `grey.png` | Greys |
| 5 | `light-being.png` | Light Beings |
| 6 | `goddess.png` | Goddess |
| 7 | `fractal-being.png` | Fractal Architects |
| 8 | `serpent.png` | Serpent / Ouroboros |
| 9 | `ancestor.png` | Ancestors / Guides |
| 10 | `the-other.png` | The Other |

Prefer exporting from Canva as **PNG with transparent background** (not JPG). If black fringing remains, re-run the convert script or raise the black-key threshold.
