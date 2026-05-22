/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WifiListComponent } from './wifi-list.component';

describe('WifiListComponent', () => {
  let component: WifiListComponent;
  let fixture: ComponentFixture<WifiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
