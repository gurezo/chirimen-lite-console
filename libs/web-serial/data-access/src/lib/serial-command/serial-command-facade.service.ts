/// <reference types="@types/w3c-web-serial" />

/** Command API; 実装は {@link SerialCommandPipelineService}（#663）。 */
export type {
  CommandExecutionConfig,
  CommandResult,
} from './serial-command-types';

export {
  SerialCommandPipelineService,
  SerialCommandPipelineService as SerialCommandService,
  type SerialCommandEnqueueOptions,
} from './serial-command-pipeline.service';
