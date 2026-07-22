import { TestBed } from '@angular/core/testing';
import { FileContentService, SerialFacadeService } from '@libs-web-serial';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WifiConfigService } from './wifi-config.service';
import { WifiRebootFlowService } from './wifi-reboot-flow.service';

describe('WifiConfigService', () => {
  let service: WifiConfigService;
  let exec$: ReturnType<typeof vi.fn>;
  let writeTextFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    exec$ = vi.fn().mockReturnValue(of({ stdout: '', stderr: '', exitCode: 0 }));
    writeTextFile = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        WifiConfigService,
        {
          provide: SerialFacadeService,
          useValue: { exec$ },
        },
        {
          provide: FileContentService,
          useValue: { writeTextFile },
        },
        {
          provide: WifiRebootFlowService,
          useValue: { restartWifiService: vi.fn() },
        },
      ],
    });

    service = TestBed.inject(WifiConfigService);
  });

  it('writes wifi_setup.sh under /tmp and runs it from that path', async () => {
    await service.setWiFi('MyNet', 'secret');

    expect(writeTextFile).toHaveBeenCalledTimes(1);
    const [path, script] = writeTextFile.mock.calls[0] as [string, string];
    expect(path).toBe('/tmp/wifi_setup.sh');

    expect(script).toContain('<<WPA_CONF_EOF');
    expect(script).toContain('\nWPA_CONF_EOF\n');
    expect(script).toContain('wpa_cli -i wlan0 reconfigure');
    expect(script).toContain('nmcli dev wifi connect');
    // bare EOL delimiter must not appear as a whole line (heredoc clash)
    expect(script.split(/\r?\n/).some((line) => line === 'EOL')).toBe(false);

    const runCmd = exec$.mock.calls
      .map((args: unknown[]) => args[0] as string)
      .find((cmd) => cmd.includes('/tmp/wifi_setup.sh'));
    expect(runCmd).toBe(
      `chmod +x /tmp/wifi_setup.sh && /tmp/wifi_setup.sh 'MyNet' 'secret'`,
    );
  });
});
