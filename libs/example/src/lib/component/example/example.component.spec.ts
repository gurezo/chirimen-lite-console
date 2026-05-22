import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExampleComponent } from './example.component';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fill outlet height and use flex shell layout', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toMatch(/\bh-full\b/);
    expect(host.className).toMatch(/\bblock\b/);
    const outer = host.querySelector(':scope > div');
    expect(outer?.className).toMatch(/\bjustify-center\b/);
    expect(outer?.className).toMatch(/\bh-full\b/);
  });
});
