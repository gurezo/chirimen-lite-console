/**
 * Subset of chirimen-certified-devices `generated/devices.json`.
 * Extra fields in the upstream document are ignored.
 */

export const CERTIFIED_DEVICES_JSON_URL =
  'https://raw.githubusercontent.com/gurezo/chirimen-certified-devices/main/generated/devices.json';

/** CDN fallback when GitHub raw is blocked (CORS / rate limit). */
export const CERTIFIED_DEVICES_JSON_FALLBACK_URL =
  'https://cdn.jsdelivr.net/gh/gurezo/chirimen-certified-devices@main/generated/devices.json';

export const PIZERO_ESM_PLATFORM = 'pizero-esm';
export const PRIMARY_EXAMPLE_STATUS = 'primary';
export const REMOTE_DEVICE_ID_PREFIX = 'remote_';

export interface CertifiedDeviceExample {
  platform: string;
  status: string;
  upstreamPath: string;
  circuitUrl: string | null;
}

export interface CertifiedDeviceMeta {
  id: string;
  model: string;
  tag: string;
  category: string;
  description: string;
  image: string | null;
  examples: CertifiedDeviceExample[];
}

export interface CertifiedDevice {
  id: string;
  meta: CertifiedDeviceMeta;
}

export interface CertifiedDevicesDocument {
  version: number;
  devices: CertifiedDevice[];
}
