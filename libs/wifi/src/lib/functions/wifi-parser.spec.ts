/// <reference types="vitest/globals" />
import { parseWifiIwlistOutput } from './wifi-parser';

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
