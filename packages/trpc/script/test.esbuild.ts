import * as esbuild from 'esbuild';
import * as path from 'path';
import copy from 'esbuild-plugin-copy';

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
      ...sync('./test/*.spec.ts', {}).map((item) => ({
        in: `${item}`,
        out: item.slice(0, -3),
      })),
      { in: './test/index.ts', out: 'test/index' },
      { in: './test/bootstrap/extension.ts', out: 'index' },
      { in: './test/bootstrap/webview.ts', out: 'webview' },
    ],
    splitting: false,
    outdir: path.join(process.cwd(), './test-dist'),

    // minify: true,
    tsconfig: 'tsconfig.spec.json',
    charset: 'utf8',
    external: ['vscode', 'mocha'],
    plugins: [
      copy({
        assets: [
          { from: './test/bootstrap/package.json', to: `./package.json` },
        ],
      }),
    ],
  };
  await esbuild.build(options);
}
main();
