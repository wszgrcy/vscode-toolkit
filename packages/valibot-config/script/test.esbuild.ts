import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import copy from 'esbuild-plugin-copy';
import { writePackageJsonConfig } from './contributes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  let {
    default: { sync },
  } = await import('fast-glob');
  const options: esbuild.BuildOptions = {
    format: 'cjs',
    platform: 'node',
    sourcemap: 'linked',
    bundle: true,
    entryPoints: [
      ...(await sync('./test/*.spec.ts', { cwd: process.cwd() })).map(
        (item) => ({
          in: `${item}`,
          out: item.slice(0, -3),
        }),
      ),
      { in: './test/index.ts', out: 'test/index' },
      { in: './test/bootstrap/extension.ts', out: 'index' },
    ],
    splitting: false,
    outdir: path.join(process.cwd(), './test-dist'),

    tsconfig: 'tsconfig.spec.json',
    charset: 'utf8',
    external: ['vscode', 'mocha'],
    plugins: [
      copy({
        assets: [
          {
            from: './test/bootstrap/package.json',
            to: `./package.json`,
          },
        ],
      }),
    ],
  };
  await esbuild.build(options);
  const packageJsonPath = path.join(__dirname, '../test-dist/package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
  const enrichedPackageJson = await writePackageJsonConfig(packageJsonContent);
  fs.writeFileSync(
    path.join(process.cwd(), './test-dist/package.json'),
    JSON.stringify(enrichedPackageJson, null, 2),
  );
}
main();
