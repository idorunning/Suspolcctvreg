# Leaflet marker assets

This directory must contain the three Leaflet default-marker PNGs so the
application has zero dependencies on external CDNs (previously
`cdnjs.cloudflare.com`).

Required files:

- `marker-icon.png`
- `marker-icon-2x.png`
- `marker-shadow.png`

They are part of the `leaflet` npm package and can be copied straight out of
`node_modules/leaflet/dist/images/`:

```sh
cp node_modules/leaflet/dist/images/marker-icon.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-shadow.png public/leaflet/
```

The frontend Docker build (`Dockerfile.frontend`) performs this copy
automatically during the build stage, so no manual step is required in
production. Developers running `npm run dev` should copy the assets once
after `npm install`.
