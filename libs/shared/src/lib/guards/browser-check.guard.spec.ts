import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { vi } from 'vitest';

import { browserCheckGuard } from './browser-check.guard';
import { BrowserCheckService } from './browser-check.service';

describe('browserCheckGuard', () => {
  const executeGuard = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ) => TestBed.runInInjectionContext(() => browserCheckGuard(route, state));

  let router: Router;
  let browserCheckService: { isSupported: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    browserCheckService = { isSupported: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BrowserCheckService, useValue: browserCheckService },
      ],
    });
    router = TestBed.inject(Router);
  });

  describe('ルートパスへのアクセス時', () => {
    afterEach(() => {
      browserCheckService.isSupported.mockReset();
    });

    it('対応ブラウザの場合はそのまま表示を許可してtrueを返す', () => {
      browserCheckService.isSupported.mockReturnValue(true);

      const route = {
        routeConfig: { path: '' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toBe(true);
    });

    it('非対応ブラウザの場合はサポート外ページへリダイレクトするUrlTreeを返す', () => {
      browserCheckService.isSupported.mockReturnValue(false);

      const route = {
        routeConfig: { path: '' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toEqual(router.parseUrl('/unsupported-browser'));
    });
  });

  describe('サポート外ブラウザページへのアクセス時', () => {
    afterEach(() => {
      browserCheckService.isSupported.mockReset();
    });

    it('対応ブラウザの場合はホームページへリダイレクトするUrlTreeを返す', () => {
      browserCheckService.isSupported.mockReturnValue(true);

      const route = {
        routeConfig: { path: 'unsupported-browser' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toEqual(router.parseUrl('/'));
    });

    it('非対応ブラウザの場合はそのまま表示を許可してtrueを返す', () => {
      browserCheckService.isSupported.mockReturnValue(false);

      const route = {
        routeConfig: { path: 'unsupported-browser' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toBe(true);
    });
  });
});
