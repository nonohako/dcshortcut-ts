/**
 * manifest.json의 version을 package.json에 동기화합니다.
 * 버전은 manifest.json을 단일 소스로 유지할 때 사용합니다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf-8'));
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

pkg.version = manifest.version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json version synced to ${manifest.version}`);
