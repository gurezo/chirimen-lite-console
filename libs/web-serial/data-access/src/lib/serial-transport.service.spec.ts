import { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SerialTransportService } from './serial-transport.service';

describe('SerialTransportService', () => {
  let service: SerialTransportService;

  beforeEach(() => {
    service = new SerialTransportService();
  });

  it('should report not connected and idle state before any session', async () => {
    expect(service.isConnected()).toBe(false);
    expect(service.getPort()).toBeUndefined();
    expect(service.getPortInfo()).toBeNull();
    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SerialSessionState.Idle);
    const connectedFlag = await firstValueFrom(service.isConnected$);
    expect(connectedFlag).toBe(false);
  });
});
