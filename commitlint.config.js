/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-angular'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'connect',
        'console',
        'console-shell',
        'page-not-found',
        'web-serial',
        'example',
        'wifi',
        'dialogs',
        'unsupported-browser',
        'editor',
        'terminal',
        'pin-assign-panel',
        'shared',
        'i2cdetect',
        'workspace',
        'setup',
        'chirimen-setup',
        'file-manager',
        'remote',
      ],
    ],
  },
};
