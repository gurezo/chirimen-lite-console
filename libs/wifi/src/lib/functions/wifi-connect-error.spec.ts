/// <reference types="vitest/globals" />
import {
  classifyWifiConnectFailure,
  messageForWifiConnectKind,
  toWifiConnectError,
  WifiConnectError,
  wifiConnectErrorFromOutput,
} from './wifi-connect-error';

describe('classifyWifiConnectFailure', () => {
  it('detects nmcli secrets / auth style messages as auth', () => {
    expect(
      classifyWifiConnectFailure(
        'Error: Connection activation failed: Secrets were required, but not provided.',
      ),
    ).toBe('auth');
    expect(
      classifyWifiConnectFailure('802-11-wireless-security property invalid'),
    ).toBe('auth');
    expect(classifyWifiConnectFailure('wrong password')).toBe('auth');
  });

  it('treats generic failures as command', () => {
    expect(classifyWifiConnectFailure('WIFI_CONNECT_FAILED')).toBe('command');
    expect(classifyWifiConnectFailure('Command execution timeout')).toBe(
      'command',
    );
  });
});

describe('wifiConnectErrorFromOutput', () => {
  it('returns null when output has no failure markers', () => {
    expect(wifiConnectErrorFromOutput('Device wlan0 successfully activated')).toBeNull();
    expect(wifiConnectErrorFromOutput('')).toBeNull();
  });

  it('returns auth error for secrets required', () => {
    const err = wifiConnectErrorFromOutput(
      'Error: Connection activation failed: Secrets were required, but not provided.\nWIFI_CONNECT_FAILED',
    );
    expect(err).toBeInstanceOf(WifiConnectError);
    expect(err?.kind).toBe('auth');
    expect(err?.message).toBe(messageForWifiConnectKind('auth'));
  });

  it('returns command error for WIFI_CONNECT_FAILED alone', () => {
    const err = wifiConnectErrorFromOutput('WIFI_CONNECT_FAILED');
    expect(err?.kind).toBe('command');
    expect(err?.message).toBe(messageForWifiConnectKind('command'));
  });
});

describe('toWifiConnectError', () => {
  it('preserves WifiConnectError instances', () => {
    const original = new WifiConnectError('auth', 'x');
    expect(toWifiConnectError(original)).toBe(original);
  });

  it('maps unknown errors without leaking raw secrets into message', () => {
    const err = toWifiConnectError(
      new Error('Failed to set WiFi: password=supersecret timeout'),
    );
    expect(err.kind).toBe('command');
    expect(err.message).toBe(messageForWifiConnectKind('command'));
    expect(err.message).not.toContain('supersecret');
  });
});
