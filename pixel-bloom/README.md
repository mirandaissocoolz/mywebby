# Pixel Bloom for your website

Files:
- `pixel-bloom.js`: the effect itself (plain JavaScript and WebGL, with no dependencies).
- `index.html`: a minimal example page.

## Using your saved design
1. In the Pixel Bloom canvas, open **Save & export** and click **Copy settings**.
2. Paste that JSON into `SETTINGS` in `index.html`, or into your own site code.

## Prompt for Claude Code
> Add the Pixel Bloom background from `pixel-bloom.js` to my site. Put a full-bleed
> `<canvas>` behind the hero section and call `createPixelBloom(canvas, SETTINGS)`
> with these settings: <paste JSON>. Make it work with my framework, and call
> `destroy()` when the component unmounts.

Notes: the animation stops for visitors who have "reduce motion" turned on. Call `bloom.update({...})` to change any setting live.
