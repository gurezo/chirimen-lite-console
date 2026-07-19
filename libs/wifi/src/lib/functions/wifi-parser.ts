import type { WiFiInfo } from '@libs-shared';

/**
 * iwlist scanコマンドの出力をパース
 *
 * @param output iwlist scanコマンドの出力
 * @returns WiFiInfo配列
 */
export function parseWifiIwlistOutput(output: string): WiFiInfo[] {
  const lines = output.split('\n');
  const wifiInfos: WiFiInfo[] = [];
  let wifiInfo: Partial<WiFiInfo> = {};
  let first = true;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.indexOf('Cell') >= 0 && line.indexOf('Address') > 0) {
      const parts = line.split(/\s+/);
      if (!first) {
        wifiInfos.push(wifiInfo as WiFiInfo);
      } else {
        first = false;
      }
      wifiInfo = { address: parts[5] };
    } else if (line.indexOf('ESSID:') >= 0) {
      wifiInfo.ssid = line.split(':')[1].trim().replace(/"/g, '');
    } else if (line.indexOf('IEEE 802.11') >= 0) {
      wifiInfo.spec = line.split(':')[1].trim();
    } else if (line.indexOf('Protocol:') >= 0) {
      wifiInfo.spec = line.split(':')[1].trim();
    } else if (line.indexOf('Quality') >= 0) {
      wifiInfo.quality = line.trim();
    } else if (line.indexOf('Group Cipher') >= 0) {
      wifiInfo.spec += ',' + line.split(':')[1].trim();
    } else if (line.indexOf('Pairwise Ciphers') >= 0) {
      wifiInfo.spec += ',' + line.split(':')[1].trim();
    } else if (line.indexOf('Authentication Suites') >= 0) {
      wifiInfo.spec += line.split(':')[1].trim();
    } else if (line.indexOf('Frequency:') >= 0) {
      wifiInfo.frequency = line.split(':')[1].trim();
      const channelMatch = line.match(/Channel (\d+)/);
      if (channelMatch) {
        wifiInfo.channel = parseInt(channelMatch[1], 10);
      }
    } else if (line.indexOf('Channel:') >= 0) {
      wifiInfo.channel = parseInt(line.split(':')[1].trim(), 10);
    }
  }
  wifiInfos.push(wifiInfo as WiFiInfo);

  return wifiInfos;
}

/**
 * ifconfigコマンドの出力をパース
 *
 * @param output ifconfigコマンドの出力
 * @returns IP情報オブジェクト
 */
export function parseWifiIfconfigOutput(output: string): {
  ipInfo: string;
  ipaddr?: string;
} {
  let wdf = false;
  let ipInfo = 'wlan0: ';
  let ipaddr: string | undefined;

  for (const line of output.split('\n')) {
    if (line.indexOf('wlan0:') >= 0) {
      wdf = true;
    } else if (line === '') {
      wdf = false;
    }
    if (wdf) {
      if (line.indexOf('inet ') >= 0) {
        ipInfo += line + '\n';
        ipaddr = line;
      } else if (line.indexOf('ether ') >= 0) {
        ipInfo +=
          'MAC Address: ' +
          line.substring(
            line.indexOf('ether ') + 6,
            line.indexOf('txqueuelen')
          ) +
          '\n';
      }
    }
  }
  ipInfo += '\n';

  return { ipInfo, ipaddr };
}

/**
 * iwconfigコマンドの出力をパース
 *
 * @param output iwconfigコマンドの出力
 * @returns WiFi設定情報文字列
 */
export function parseWifiIwconfigOutput(output: string): string {
  let wdf = false;
  let wlInfo = '';

  for (const line of output.split('\n')) {
    if (line.indexOf('wlan0') >= 0) {
      wdf = true;
    } else if (line === '') {
      wdf = false;
    }
    if (wdf) {
      wlInfo += line + '\n';
    }
  }

  return wlInfo;
}

/**
 * iwconfig 出力から接続中 ESSID を抽出する
 *
 * @param output iwconfigコマンドの出力（全体または wlan0 断片）
 * @returns 接続中 SSID。未接続・不明時は null
 */
export function parseConnectedSsid(output: string): string | null {
  const match = output.match(/ESSID:"([^"]*)"/);
  if (!match) {
    return null;
  }
  const ssid = match[1].trim();
  if (!ssid || ssid === 'off/any') {
    return null;
  }
  return ssid;
}

/**
 * iwlist quality 行を短い Signal 表示に整形する
 *
 * @param quality 例: `Quality=53/70  Signal level=-57 dBm`
 */
export function formatWifiSignal(quality: string | undefined | null): string {
  if (!quality?.trim()) {
    return '—';
  }
  const signalMatch = quality.match(/Signal level=(-?\d+\s*dBm)/i);
  if (signalMatch) {
    return signalMatch[1].replace(/\s+/g, ' ').trim();
  }
  const qualityMatch = quality.match(/Quality=(\d+\/\d+)/i);
  if (qualityMatch) {
    return qualityMatch[1];
  }
  return quality.trim();
}

/**
 * iwlist spec を短い Security 表示に整形する
 *
 * @param spec 例: `IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK`
 */
export function formatWifiSecurity(spec: string | undefined | null): string {
  if (!spec?.trim()) {
    return 'Open';
  }
  const upper = spec.toUpperCase();
  if (upper.includes('WPA3')) {
    return 'WPA3';
  }
  if (upper.includes('WPA2')) {
    return 'WPA2';
  }
  if (upper.includes('WPA')) {
    return 'WPA';
  }
  if (upper.includes('WEP')) {
    return 'WEP';
  }
  return 'Open';
}

/**
 * 一覧表示用の SSID ラベル（空は非公開）
 */
export function formatWifiSsidLabel(ssid: string | undefined | null): string {
  const trimmed = ssid?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '（非公開）';
}
