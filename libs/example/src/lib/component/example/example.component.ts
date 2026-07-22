import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NotificationService } from '@libs-shared';
import { BehaviorSubject, forkJoin } from 'rxjs';
import { ExampleItem } from '../../models';
import { ExampleDataService, ExampleDownloadService } from '../../service';
import { ExampleListComponent } from '../example-list/example-list.component';

@Component({
  selector: 'choh-example',
  imports: [ExampleListComponent, AsyncPipe],
  templateUrl: './example.component.html',
  host: {
    class: 'flex min-h-0 h-full w-full flex-col',
  },
})
export class ExampleComponent implements OnInit {
  private exampleDataService = inject(ExampleDataService);
  private exampleDownload = inject(ExampleDownloadService);
  private notify = inject(NotificationService);

  readonly downloadInProgress = signal(false);

  exampleSubject = new BehaviorSubject<
    [ExampleItem[], ExampleItem[], ExampleItem[]]
  >([[], [], []]);
  example$ = this.exampleSubject.asObservable();

  ngOnInit(): void {
    this.example$ = forkJoin([
      this.exampleDataService.getGPIOExampleList(),
      this.exampleDataService.getI2CExampleList(),
      this.exampleDataService.getRemoteExampleList(),
    ]);
  }

  async onSaveExample(example: ExampleItem): Promise<void> {
    if (this.downloadInProgress()) {
      return;
    }

    this.downloadInProgress.set(true);
    try {
      const fileName = await this.exampleDownload.downloadToShellCwd(example.id);
      this.notify.success(
        'Example',
        `${fileName} をターミナルのカレントディレクトリに保存しました`,
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'ソースのダウンロードに失敗しました';
      this.notify.error('Example', msg);
      console.warn('Failed to save example', error);
    } finally {
      this.downloadInProgress.set(false);
    }
  }
}
