import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { computed, signal } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';

import { connectionGuard } from './connection.guard';

describe('connectionGuard', () => {
  const executeGuard = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) =>
    TestBed.runInInjectionContext(() =>
      connectionGuard(route, state) as ReturnType<typeof connectionGuard>
    );

  let router: Router;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    isConnectedSignal = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: computed(() => isConnectedSignal()),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  describe('接続不要ルート（path: ""）', () => {
    it('常に true を返して許可する', () => {
      isConnectedSignal.set(true);

      const route = {
        routeConfig: { path: '' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toBe(true);
    });
  });

  describe('接続不要ルート（path: "unsupported-browser"）', () => {
    it('常に true を返して許可する', () => {
      isConnectedSignal.set(false);

      const route = {
        routeConfig: { path: 'unsupported-browser' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toBe(true);
    });
  });

  describe('接続必須ルート（上記以外）', () => {
    it('接続済みの場合は true を返して許可する', () => {
      isConnectedSignal.set(true);

      const route = {
        routeConfig: { path: 'terminal' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toBe(true);
    });

    it('未接続の場合は "/" へリダイレクトする UrlTree を返す', () => {
      isConnectedSignal.set(false);

      const route = {
        routeConfig: { path: 'terminal' },
      } as unknown as ActivatedRouteSnapshot;
      const state = {} as RouterStateSnapshot;

      const result = executeGuard(route, state);

      expect(result).toEqual(router.parseUrl('/'));
    });
  });
});
