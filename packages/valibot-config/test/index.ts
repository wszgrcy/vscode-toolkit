import * as path from 'path';
import Mocha from 'mocha';
import fg from 'fast-glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    timeout: 20_000,
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise(async (c, e) => {
    const files = await fg('**/**.spec.js', { cwd: testsRoot });
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error(err);
      e(err);
    }
  });
}
