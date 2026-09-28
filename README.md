# spritemotion

## Export formats

| Content | Formats |
| --- | --- |
| Selected frame | SVG, ICO |
| Active animation | Animated SVG, Lottie JSON, Windows ANI |
| Complete editable project | Spritemotion JSON |

SVG and Lottie output compact adjacent same-color pixels into horizontal vector runs.
ICO files embed a lossless PNG, and ANI files use the Windows RIFF/ACON container with
one embedded ICO frame per animation frame.
