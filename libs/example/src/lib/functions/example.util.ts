import type { ExampleJson, ExampleItem } from '../models';

const EXAMPLE_MAIN_JS_BASE_URL =
  'https://tutorial.chirimen.org/pizero/esm-examples';

export function convertExampleJsonToList(
  jsonList: ExampleJson[],
): ExampleItem[] {
  return jsonList.map((json: ExampleJson) => ({
    ...json,
    js: '',
    circuit: '',
    link: '',
  }));
}

/** Builds the upstream main.js URL for a CHIRIMEN example id. */
export function buildExampleMainJsUrl(exampleId: string): string {
  return `${EXAMPLE_MAIN_JS_BASE_URL}/${exampleId}/main.js`;
}

/** Builds the on-device file name used when downloading an example (legacy panel: `main-<id>.js`). */
export function buildExampleDownloadFileName(exampleId: string): string {
  return `main-${exampleId}.js`;
}
