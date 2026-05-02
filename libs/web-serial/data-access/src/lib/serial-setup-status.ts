export type SerialSetupStatus =
  | 'idle'
  | 'waiting-login'
  | 'sending-username'
  | 'sending-password'
  | 'waiting-shell'
  | 'setting-timezone'
  | 'ready'
  | 'failed';
