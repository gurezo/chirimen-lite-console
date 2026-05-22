import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExampleDataService } from './example.data.service';
import { ExampleService } from './example.service';

describe('ExampleDataService', () => {
  let service: ExampleDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExampleDataService, ExampleService],
    });
    service = TestBed.inject(ExampleDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
