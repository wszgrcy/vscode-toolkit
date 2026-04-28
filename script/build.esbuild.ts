import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { sync } from 'fast-glob';
import { version, repository } from '../package.json';
// 发布之前构建
async function main() {
  let options: esbuild.BuildOptions = {
    platform: 'node',
    bundle: true,
    sourcemap: true,
    entryPoints: [
      ...sync('*', {
        onlyDirectories: true,
        cwd: 'packages',
        ignore: ['**/trpc'],
      }).map((item) => {
        return {
          in: `packages/${item}/index.ts`,
          out: `${item}/index`,
        };
      }),
      { in: `packages/trpc/server/index.ts`, out: 'trpc/server/index' },
      { in: `packages/trpc/client/index.ts`, out: 'trpc/client/index' },
      { in: `packages/valibot-config/valibot-to-vscode-config.ts`, out: 'valibot-config/valibot-to-vscode-config' },
    ],
    charset: 'utf8',
    splitting: false,
    outdir: path.join(process.cwd(), '/dist'),
    format: 'esm',
    keepNames: false,
    outExtension: {
      '.js': '.mjs',
    },
    // minify: true,
    tsconfig: 'tsconfig.build.json',
    packages: 'external',
    // external: [],
    plugins: [
      // copy({
      //   resolveFrom: 'cwd',
      //   once: true,
      //   assets: [{ from: `./assets/*`, to: './dist' }],
      // }),
    ],
  };
  await esbuild.build(options);
  const packages = sync('*', {
    onlyDirectories: true,
    cwd: path.join(process.cwd(), 'packages'),
  });
  const subPackageNames = packages.map((pkg) => `@cyia/${pkg}`);
  for (const pkg of packages) {
    const pkgJsonPath = path.join(
      process.cwd(),
      'packages',
      pkg,
      'package.json',
    );
    const distPkgPath = path.join(process.cwd(), 'dist', pkg, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      fs.copyFileSync(pkgJsonPath, distPkgPath);
      const distPkgJson = JSON.parse(fs.readFileSync(distPkgPath, 'utf-8'));
      distPkgJson.version = version;
      distPkgJson.repository = repository;
      for (const depType of ['dependencies', 'peerDependencies']) {
        if (distPkgJson[depType]) {
          for (const subPkgName of subPackageNames) {
            if (distPkgJson[depType][subPkgName] !== undefined) {
              distPkgJson[depType][subPkgName] = version;
            }
          }
        }
      }

      fs.writeFileSync(
        distPkgPath,
        JSON.stringify(distPkgJson, null, 2) + '\n',
      );

      // Copy README files to dist package
      const readmeFiles = ['README.md'];
      for (const readme of readmeFiles) {
        const srcReadmePath = path.join(process.cwd(), 'packages', pkg, readme);
        if (fs.existsSync(srcReadmePath)) {
          const distReadmePath = path.join(process.cwd(), 'dist', pkg, readme);
          fs.copyFileSync(srcReadmePath, distReadmePath);
        }
      }
    }
  }
}
main();
