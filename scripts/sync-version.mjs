/**
 * package.json의 version을 manifest.json과 README 배지에 동기화합니다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

manifest.version = pkg.version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const readmePath = path.join(root, 'README.md');
const readme = readFileSync(readmePath, 'utf-8');
writeFileSync(readmePath, readme.replace(/(https:\/\/img\.shields\.io\/badge\/version-)[\d.]+(-)/, `$1${pkg.version}$2`));
console.log(`manifest.json and README version synced to ${pkg.version}`);
