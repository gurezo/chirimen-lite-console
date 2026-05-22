/**
 * WiFi情報
 *
 * porting/types/wifi-info.ts と shared/models/wifi.models.ts を統合
 * - essid → ssid に統一
 * - channel: string → number に統一
 */
export interface WiFiInfo {
  /** SSID（ネットワーク名） */
  ssid: string;
  /** MACアドレス */
  address: string;
  /** チャンネル番号 */
  channel: number;
  /** 周波数 */
  frequency: string;
  /** 品質（シグナルレベル） */
  quality: string;
  /** セキュリティ仕様 */
  spec: string;
}

/**
 * WiFi情報のダミーデータ（テスト・開発用）
 */
export const dummyWiFiInfo: WiFiInfo[] = [
  {
    ssid: 'imajin-coffee',
    address: 'F2:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=53/70  Signal level=-57 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK unknown (8)',
  },
  {
    ssid: 'pr400k-4fc052-1',
    address: 'A4:12:42:84:FB:45',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=32/70  Signal level=-78 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,TKIP,CCMP TKIPPSK,TKIP,CCMP TKIPPSK',
  },
  {
    ssid: 'pr400k-4fc052-2',
    address: 'A6:12:42:84:FB:45',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=27/70  Signal level=-83 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,TKIP,CCMP TKIPPSK,TKIP,CCMP TKIPPSK',
  },
  {
    ssid: 'imagineohta-pos',
    address: 'DC:A4:CA:BC:4C:8C',
    channel: 11,
    frequency: '2.462 GHz (Channel 11)',
    quality: 'Quality=34/70  Signal level=-76 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: 'Gmansyu.ootamooru',
    address: 'CA:E9:0A:20:44:93',
    channel: 11,
    frequency: '2.462 GHz (Channel 11)',
    quality: 'Quality=18/70  Signal level=-92 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: '',
    address: 'F2:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=51/70  Signal level=-59 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK unknown (8)',
  },
  {
    ssid: '',
    address: 'C6:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=60/70  Signal level=-50 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,',
  },
  {
    ssid: 'ALPINE-439436',
    address: '58:16:D7:8C:97:6A',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=31/70  Signal level=-79 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: 'Panasonic PMX900-6f50.d204,',
    address: 'FA:8F:CA:55:7A:DF',
    channel: 2,
    frequency: '2.417 GHz (Channel 2)',
    quality: 'Quality=26/70  Signal level=-84 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: 'DIRECT-9C-EPSON-267A27',
    address: '52:57:9C:26:FA:27',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=33/70  Signal level=-77 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: 'DIRECT-DR_6930_KQC01217',
    address: 'BE:82:5D:7D:1C:5C',
    channel: 6,
    frequency: '2.437 GHz (Channel 6)',
    quality: 'Quality=23/70  Signal level=-87 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    ssid: 'tsunami',
    address: 'BC:9F:E4:8A:A9:E0',
    channel: 6,
    frequency: '2.437 GHz (Channel 6)',
    quality: 'Quality=30/70  Signal level=-80 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
];

/**
 * @deprecated Use WiFiInfo instead. This interface will be removed in a future version.
 * Migration: SSID → ssid (lowercase), Use WiFiInfo interface
 */
export interface WiFiInformation {
  SSID: string;
  address: string;
  channel: number;
  frequency: string;
  quality: string;
  spec: string;
}

/**
 * @deprecated Use dummyWiFiInfo instead.
 */
export const dummyWiFiInformation: WiFiInformation[] = [
  {
    SSID: 'imajin-coffee',
    address: 'F2:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=53/70  Signal level=-57 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK unknown (8)',
  },
  {
    SSID: 'pr400k-4fc052-1',
    address: 'A4:12:42:84:FB:45',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=32/70  Signal level=-78 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,TKIP,CCMP TKIPPSK,TKIP,CCMP TKIPPSK',
  },
  {
    SSID: 'pr400k-4fc052-2',
    address: 'A6:12:42:84:FB:45',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=27/70  Signal level=-83 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,TKIP,CCMP TKIPPSK,TKIP,CCMP TKIPPSK',
  },
  {
    SSID: 'imagineohta-pos',
    address: 'DC:A4:CA:BC:4C:8C',
    channel: 11,
    frequency: '2.462 GHz (Channel 11)',
    quality: 'Quality=34/70  Signal level=-76 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: 'Gmansyu.ootamooru',
    address: 'CA:E9:0A:20:44:93',
    channel: 11,
    frequency: '2.462 GHz (Channel 11)',
    quality: 'Quality=18/70  Signal level=-92 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: '',
    address: 'F2:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=51/70  Signal level=-59 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK unknown (8)',
  },
  {
    SSID: '',
    address: 'C6:9E:28:74:E6:1F',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=60/70  Signal level=-50 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,',
  },
  {
    SSID: 'ALPINE-439436',
    address: '58:16:D7:8C:97:6A',
    channel: 1,
    frequency: '2.412 GHz (Channel 1)',
    quality: 'Quality=31/70  Signal level=-79 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: 'Panasonic PMX900-6f50.d204,',
    address: 'FA:8F:CA:55:7A:DF',
    channel: 2,
    frequency: '2.417 GHz (Channel 2)',
    quality: 'Quality=26/70  Signal level=-84 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: 'DIRECT-9C-EPSON-267A27',
    address: '52:57:9C:26:FA:27',
    channel: 5,
    frequency: '2.432 GHz (Channel 5)',
    quality: 'Quality=33/70  Signal level=-77 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: 'DIRECT-DR_6930_KQC01217',
    address: 'BE:82:5D:7D:1C:5C',
    channel: 6,
    frequency: '2.437 GHz (Channel 6)',
    quality: 'Quality=23/70  Signal level=-87 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
  {
    SSID: 'tsunami',
    address: 'BC:9F:E4:8A:A9:E0',
    channel: 6,
    frequency: '2.437 GHz (Channel 6)',
    quality: 'Quality=30/70  Signal level=-80 dBm',
    spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
  },
];
