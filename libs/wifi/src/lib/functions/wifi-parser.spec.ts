/// <reference types="vitest/globals" />
import {
  formatWifiSecurity,
  formatWifiSignal,
  formatWifiSsidLabel,
  parseConnectedSsid,
  parseWifiIwlistOutput,
} from './wifi-parser';

describe('parseWifiIwlistOutput', () => {
  it('parses a minimal iwlist scan fragment', () => {
    const sample = `wlan0     Scan completed :
          Cell 01 - Address: AA:BB:CC:DD:EE:FF
                    ESSID:"test-net"
                    Protocol:IEEE 802.11bg
                    Frequency:2.412 GHz (Channel 1)
                    Quality=50/70  Signal level=-60 dBm  
`;

    const list = parseWifiIwlistOutput(sample);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const first = list[0];
    expect(first?.ssid).toBe('test-net');
    expect(first?.address).toBe('AA:BB:CC:DD:EE:FF');
    expect(first?.channel).toBe(1);
  });
});

describe('parseConnectedSsid', () => {
  it('extracts ESSID from iwconfig output', () => {
    const sample = `wlan0     IEEE 802.11  ESSID:"home-net"
          Mode:Managed  Frequency:2.412 GHz
`;
    expect(parseConnectedSsid(sample)).toBe('home-net');
  });

  it('returns null when ESSID is off/any or empty', () => {
    expect(parseConnectedSsid('wlan0  ESSID:"off/any"')).toBeNull();
    expect(parseConnectedSsid('wlan0  ESSID:""')).toBeNull();
    expect(parseConnectedSsid('no essid here')).toBeNull();
  });
});

describe('formatWifiSignal', () => {
  it('prefers Signal level when present', () => {
    expect(
      formatWifiSignal('Quality=53/70  Signal level=-57 dBm'),
    ).toBe('-57 dBm');
  });

  it('falls back to Quality fraction', () => {
    expect(formatWifiSignal('Quality=50/70')).toBe('50/70');
  });

  it('returns em dash for empty quality', () => {
    expect(formatWifiSignal('')).toBe('—');
    expect(formatWifiSignal(null)).toBe('—');
  });
});

describe('formatWifiSecurity', () => {
  it('summarizes WPA2 / WPA / Open', () => {
    expect(
      formatWifiSecurity('IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK'),
    ).toBe('WPA2');
    expect(formatWifiSecurity('WPA Version 1')).toBe('WPA');
    expect(formatWifiSecurity('')).toBe('Open');
    expect(formatWifiSecurity(null)).toBe('Open');
  });
});

describe('formatWifiSsidLabel', () => {
  it('returns ssid or hidden label', () => {
    expect(formatWifiSsidLabel('cafe')).toBe('cafe');
    expect(formatWifiSsidLabel('')).toBe('（非公開）');
    expect(formatWifiSsidLabel('   ')).toBe('（非公開）');
  });
});
