/**
 * Hero poster variants (F9: the Blender poster must paint instantly). Pre-encoded from public/models/nexmed-hero.png
 * (Cycles render, blender/build_hero.py) so the browser fetches a 66–172 KB WebP straight from the CDN — no image
 * optimizer round trip — and shows the inline 24 px LQIP blur before that.
 * Regenerate after a new render:
 *   for w in 640 960 1500; do ffmpeg -y -i public/models/nexmed-hero.png -vf "scale=$w:-1:flags=lanczos" -c:v libwebp -quality 82 -pix_fmt yuva420p public/models/nexmed-hero-$w.webp; done
 *   ffmpeg -y -i public/models/nexmed-hero.png -vf "scale=24:-1:flags=area" -c:v libwebp -quality 60 -pix_fmt yuva420p public/models/hero-lqip.webp  # then paste base64 below
 */
export const HERO_POSTER = {
  src: "/models/nexmed-hero-960.webp",
  srcSet: "/models/nexmed-hero-640.webp 640w, /models/nexmed-hero-960.webp 960w, /models/nexmed-hero-1500.webp 1500w",
  sizes: "(min-width: 1024px) 560px, 92vw",
  width: 1500,
  height: 1500,
  lqip: "data:image/webp;base64,UklGRvoBAABXRUJQVlA4WAoAAAAQAAAAFwAAFwAAQUxQSPQAAAABgLpt2/FX/Ht8x/P9fr/ZXrJtZtveollt27a9ZjY3NTXb25s+DRExAfA/k0Lskry8BWohyYF+AjYiZREBVuHt6TF6bGK1nNoLGp0TE/MlWZglaVYMW+Yc9LsCS1HrtkZnr7lMO2AtmVWWmvHYKswOwCDeccIYuMzuL4wCTps2m3rAypIDEfv5GahO5yB7fzafPBlVYEUubc20OODXeEaazVsJnsdm/fNFGI8x8j34vv7G1OdCPDr+KmZcIydCJWnxyexTVZTuntmjsoCKLx9zweQ2SQAAgBBChEA1duzg7vPz/ng2XQMQYwL4wuISokIkgagBVlA4IOAAAABwBQCdASoYABgAPrVOoEsnJCMhsBgIAOAWiWIAnTKAJagk/YBAhhZxpO5thBuOdvWnGpsAAP7653zqMRNCUeq+ECBTiBNin9C2p9qx5ANH6n14jEOXmF7EBaXKxTRQo06rGeiVCExTbapbunwSD915qR/XhjZ9+mwSkUgodiSXV0nxf5zXSNrnRcnLom3cIqtB4+MjITcWbZPktYnlhLz9OMOCEfsEZOG0xTg4B2SPgG+pHtyaWqj6h7YTMzIePxW8B9LCUqdyg/Il/JpiotoBcLdo6yeM+hdkmp+6X3MAAA==",
} as const;
