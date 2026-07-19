import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const scriptDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const candidates = [
  scriptDir,
  path.dirname(scriptDir),
  process.cwd(),
].filter((value, index, array) => array.indexOf(value) === index);

const projectRoot = candidates.find((candidate) =>
  existsSync(path.join(candidate, 'app', 'paste', 'page.tsx')) &&
  existsSync(path.join(candidate, 'package.json'))
);

if (!projectRoot) {
  console.error('Could not find the Recipe Library project root.');
  console.error('Put this rollback folder inside the folder that contains package.json and app, then run ROLLBACK.bat again.');
  process.exit(1);
}

const pagePath = path.join(projectRoot, 'app', 'paste', 'page.tsx');
const pageBackup = `${pagePath}.backup-v0.9.1.3-before-source-images`;
const packagePath = path.join(projectRoot, 'package.json');
const packageBackup = `${packagePath}.backup-v0.9.1.3-before-source-images`;
const diagnosticDir = path.join(projectRoot, 'recipe-library-diagnostic');
const diagnosticZip = path.join(projectRoot, 'recipe-library-diagnostic.zip');

if (!existsSync(pageBackup)) {
  console.error(`Missing backup: ${pageBackup}`);
  console.error('Rollback stopped before changing any file.');
  process.exit(1);
}

// Preserve the broken state for diagnosis before restoring anything.
await rm(diagnosticDir, { recursive: true, force: true });
await mkdir(path.join(diagnosticDir, 'app', 'paste'), { recursive: true });
await copyFile(pagePath, path.join(diagnosticDir, 'app', 'paste', 'page.broken.tsx'));
await copyFile(pageBackup, path.join(diagnosticDir, 'app', 'paste', 'page.original.tsx'));
await copyFile(packagePath, path.join(diagnosticDir, 'package.current.json'));
if (existsSync(packageBackup)) {
  await copyFile(packageBackup, path.join(diagnosticDir, 'package.original.json'));
}

const includeRoots = ['app', 'components', 'lib', 'utils', 'types'];
async function copyTree(source, destination) {
  if (!existsSync(source)) return;
  const info = await stat(source);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
      await copyTree(path.join(source, entry), path.join(destination, entry));
    }
  } else if (/\.(?:ts|tsx|js|jsx|json|css|scss|mjs)$/i.test(source)) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

for (const root of includeRoots) {
  await copyTree(path.join(projectRoot, root), path.join(diagnosticDir, 'project', root));
}

const envNames = ['.env.example', '.env.local.example'];
for (const name of envNames) {
  const source = path.join(projectRoot, name);
  if (existsSync(source)) await copyFile(source, path.join(diagnosticDir, name));
}

// Restore the source files created before the URL/image patches.
await copyFile(pageBackup, pagePath);
if (existsSync(packageBackup)) {
  await copyFile(packageBackup, packagePath);
} else {
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  pkg.version = '0.9.1.3';
  if (pkg.scripts) delete pkg.scripts['backfill:sources'];
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

// Remove only files introduced by the failed cumulative patches.
await rm(path.join(projectRoot, 'app', 'api', 'source-metadata'), { recursive: true, force: true });
await rm(path.join(projectRoot, 'scripts', 'backfill-recipe-sources.mjs'), { force: true });

try {
  if (existsSync(diagnosticZip)) await rm(diagnosticZip, { force: true });
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    `Compress-Archive -Path '${diagnosticDir.replaceAll("'", "''")}\\*' -DestinationPath '${diagnosticZip.replaceAll("'", "''")}' -Force`,
  ], { stdio: 'inherit' });
} catch (error) {
  console.warn('The rollback succeeded, but Windows could not create the diagnostic ZIP automatically.');
  console.warn(`The diagnostic folder is here: ${diagnosticDir}`);
}

console.log(`Restored: ${pagePath}`);
console.log(`Restored: ${packagePath}`);
console.log('Database columns from the successful SQL migration were left intact; they do not affect the old importer.');
console.log(`Diagnostic: ${diagnosticZip}`);
