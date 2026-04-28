import { defineConfig } from '@vscode/test-cli';
import path from 'path';

export default defineConfig({
  files: './test-dist/test/**/*.spec.js',
  extensionDevelopmentPath: ['./test-dist'],
  mocha: {
    ui: 'bdd',
    timeout: 20_000,
  },
  launchArgs: ['--disable-extensions'],
  installExtensions: [],
  workspaceFolder: path.join(process.cwd(), './test/fixture'),
  coverage: {
    reporter: ['html'],
    output: './coverage',
  },
});
