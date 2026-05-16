/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { EMPTY } from 'rxjs';
import { LeftSidebarComponent } from './left-sidebar.component';

describe('LeftSidebarComponent', () => {
  let component: LeftSidebarComponent;
  let fixture: ComponentFixture<LeftSidebarComponent>;

  beforeEach(async () => {
    const activatedRoute = {
      firstChild: null,
      snapshot: { url: [] },
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [LeftSidebarComponent],
      providers: [
        provideMockStore(),
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true), events: EMPTY },
        },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeftSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleLeftSidebar when the panel toggle is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleLeftSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[1]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit toggleLeftSidebar when the folder icon is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleLeftSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[0]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should not render file tree when left nav is closed', () => {
    fixture.componentRef.setInput('leftNavOpen', false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('lib-file-tree-feature'),
    ).toBeNull();
  });
});
