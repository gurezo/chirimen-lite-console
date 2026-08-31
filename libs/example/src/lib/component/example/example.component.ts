import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ButtonComponent, NotificationService } from '@libs-shared';
import { DeviceExampleViewModel } from '../../models';
import {
  DeviceCatalogService,
  ExampleDataService,
  ExampleDownloadService,
} from '../../service';
import { ExampleListComponent } from '../example-list/example-list.component';

@Component({
  selector: 'choh-example',
  imports: [
    ExampleListComponent,
    AsyncPipe,
    MatProgressSpinner,
    ButtonComponent,
  ],
  templateUrl: './example.component.html',
  host: {
    class: 'flex min-h-0 h-full w-full flex-col',
  },
})
export class ExampleComponent implements OnInit {
  private exampleDataService = inject(ExampleDataService);
  private catalog = inject(DeviceCatalogService);
  private exampleDownload = inject(ExampleDownloadService);
  private notify = inject(NotificationService);

  readonly downloadInProgress = signal(false);
  readonly catalogState = this.catalog.state;

  readonly catalogDevices = computed((): DeviceExampleViewModel[] => {
    const state = this.catalogState();
    return state.status === 'success' ? state.devices : [];
  });

  remote$ = this.exampleDataService.getRemoteExampleList();

  ngOnInit(): void {
    this.catalog.load();
  }

  retryCatalog(): void {
    this.catalog.retry();
  }

  async onSaveExample(exampleId: string): Promise<void> {
    if (this.downloadInProgress()) {
      return;
    }

    this.downloadInProgress.set(true);
    try {
      const fileName = await this.exampleDownload.downloadToShellCwd(exampleId);
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
