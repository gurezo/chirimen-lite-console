import { describe, expect, it } from 'vitest';
import { coerceLsForSerialListing } from './coerce-ls-for-serial-listing';

/** 端末幅列・段状スペース対策付きの ls パイプ */
const lsSerialPipe = ' </dev/null 2>&1 | sed \'s/^[[:blank:]]*//\' | cat';
const env = 'LC_ALL=C LANG=C TERM=dumb LS_COLORS= ';

describe('coerceLsForSerialListing', () => {
  it('prepends env, -1 where needed, and pipes through cat', () => {
    expect(coerceLsForSerialListing('ls')).toBe(`${env}ls -1${lsSerialPipe}`);
    expect(coerceLsForSerialListing('ls -la')).toBe(
      `${env}ls -1 -la${lsSerialPipe}`,
    );
    expect(coerceLsForSerialListing('ls --color=never')).toBe(
      `${env}ls -1 --color=never${lsSerialPipe}`,
    );
  });

  it('does not double -1', () => {
    expect(coerceLsForSerialListing('ls -1')).toBe(`${env}ls -1${lsSerialPipe}`);
    expect(coerceLsForSerialListing('ls -1 /tmp')).toBe(
      `${env}ls -1 /tmp${lsSerialPipe}`,
    );
    expect(coerceLsForSerialListing('ls -1la')).toBe(
      `${env}ls -1la${lsSerialPipe}`,
    );
  });

  it('does not alter other commands', () => {
    expect(coerceLsForSerialListing('pwd')).toBe('pwd');
    expect(coerceLsForSerialListing('lsof')).toBe('lsof');
    expect(coerceLsForSerialListing('/bin/ls -la')).toBe('/bin/ls -la');
  });

  it('pipes explicit single-column through cat', () => {
    expect(coerceLsForSerialListing('ls --format single-column')).toBe(
      `${env}ls --format single-column${lsSerialPipe}`,
    );
    expect(coerceLsForSerialListing('ls --format=single-column')).toBe(
      `${env}ls --format=single-column${lsSerialPipe}`,
    );
  });
});
