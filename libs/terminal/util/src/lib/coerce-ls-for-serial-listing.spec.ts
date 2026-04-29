import { describe, expect, it } from 'vitest';
import { coerceLsForSerialListing } from './coerce-ls-for-serial-listing';

const catPipe = ' 2>&1 | cat';
const env = 'LC_ALL=C LANG=C TERM=dumb LS_COLORS= ';

describe('coerceLsForSerialListing', () => {
  it('prepends env, -1 where needed, and pipes through cat', () => {
    expect(coerceLsForSerialListing('ls')).toBe(`${env}ls -1${catPipe}`);
    expect(coerceLsForSerialListing('ls -la')).toBe(`${env}ls -1 -la${catPipe}`);
    expect(coerceLsForSerialListing('ls --color=never')).toBe(
      `${env}ls -1 --color=never${catPipe}`,
    );
  });

  it('does not double -1', () => {
    expect(coerceLsForSerialListing('ls -1')).toBe(`${env}ls -1${catPipe}`);
    expect(coerceLsForSerialListing('ls -1 /tmp')).toBe(
      `${env}ls -1 /tmp${catPipe}`,
    );
    expect(coerceLsForSerialListing('ls -1la')).toBe(`${env}ls -1la${catPipe}`);
  });

  it('does not alter other commands', () => {
    expect(coerceLsForSerialListing('pwd')).toBe('pwd');
    expect(coerceLsForSerialListing('lsof')).toBe('lsof');
    expect(coerceLsForSerialListing('/bin/ls -la')).toBe('/bin/ls -la');
  });

  it('pipes explicit single-column through cat', () => {
    expect(coerceLsForSerialListing('ls --format single-column')).toBe(
      `${env}ls --format single-column${catPipe}`,
    );
    expect(coerceLsForSerialListing('ls --format=single-column')).toBe(
      `${env}ls --format=single-column${catPipe}`,
    );
  });
});
