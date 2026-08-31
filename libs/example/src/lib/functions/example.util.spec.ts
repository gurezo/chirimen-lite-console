import { describe, expect, it } from 'vitest';
import {
  buildExampleDownloadFileName,
  buildExampleMainJsUrl,
} from './example.util';

describe('example.util', () => {
  it('buildExampleMainJsUrl joins id with /main.js', () => {
    expect(buildExampleMainJsUrl('hello-real-world')).toBe(
      'https://tutorial.chirimen.org/pizero/esm-examples/hello-real-world/main.js',
    );
  });

  it('buildExampleDownloadFileName prefixes main-', () => {
    expect(buildExampleDownloadFileName('hello-real-world')).toBe(
      'main-hello-real-world.js',
    );
  });
});
