import type { MediaCategory, MediaPreset } from './types';

export const LONG_LIVED_CACHE_CONTROL = '31536000, immutable';

export const MEDIA_PRESETS: Record<MediaCategory, MediaPreset> = {
  officer: {
    maxLongEdge: 900,
    targetMaxBytes: 150 * 1024,
    hardMaxBytes: 300 * 1024,
    initialQuality: 0.82,
  },
  gallery: {
    maxLongEdge: 1600,
    targetMaxBytes: 350 * 1024,
    hardMaxBytes: 600 * 1024,
    initialQuality: 0.82,
    thumbnail: {
      maxLongEdge: 480,
      targetMaxBytes: 120 * 1024,
      hardMaxBytes: 200 * 1024,
      initialQuality: 0.78,
    },
  },
  banner: {
    maxLongEdge: 1920,
    targetMaxBytes: 500 * 1024,
    hardMaxBytes: 1024 * 1024,
    initialQuality: 0.82,
    card: {
      maxLongEdge: 960,
      targetMaxBytes: 220 * 1024,
      hardMaxBytes: 400 * 1024,
      initialQuality: 0.78,
    },
    mobile: {
      maxLongEdge: 720,
      targetMaxBytes: 160 * 1024,
      hardMaxBytes: 300 * 1024,
      initialQuality: 0.76,
    },
  },
  patch: {
    maxLongEdge: 640,
    targetMaxBytes: 150 * 1024,
    hardMaxBytes: 300 * 1024,
    initialQuality: 0.8,
  },
  'document-thumbnail': {
    maxLongEdge: 640,
    targetMaxBytes: 120 * 1024,
    hardMaxBytes: 200 * 1024,
    initialQuality: 0.78,
  },
};
