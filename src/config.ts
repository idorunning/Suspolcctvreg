const env = import.meta.env;

export const config = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) || '/api',
  tileUrl:
    (env.VITE_TILE_URL as string | undefined) ||
    '/tiles/{z}/{x}/{y}.png',
  tileAttribution:
    (env.VITE_TILE_ATTRIBUTION as string | undefined) ||
    '&copy; OpenStreetMap contributors',
  geocoderUrl: (env.VITE_GEOCODER_URL as string | undefined) || '',
  adminContactEmail:
    (env.VITE_ADMIN_CONTACT_EMAIL as string | undefined) || '',
  leafletAssetsPath:
    (env.VITE_LEAFLET_ASSETS_PATH as string | undefined) || '/leaflet',
};

export const geocoderEnabled = Boolean(config.geocoderUrl);
