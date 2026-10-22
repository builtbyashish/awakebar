/**
 * Compiles native/sleep-assertion.c into bin/ for the given architecture.
 *
 * Forge calls this for the target arch before packaging, so cross-building an
 * x64 app on an Apple silicon machine produces an x64 helper.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Forge may ask for 'universal' or 'all', which clang spells as both arches. */
const archFlags = (arch) =>
  arch === 'universal' || arch === 'all'
    ? ['-arch', 'x86_64', '-arch', 'arm64']
    : ['-arch', arch === 'x64' ? 'x86_64' : arch];

/**
 * @param {string} [arch] - node/Forge architecture name.
 * @returns {string} path to the compiled helper.
 */
export const buildSleepAssertion = (arch = process.arch) => {
  const output = path.join(root, 'bin', 'AwakeBar-sleep');
  mkdirSync(path.dirname(output), { recursive: true });

  execFileSync(
    'clang',
    [
      '-O2',
      '-Wall',
      ...archFlags(arch),
      '-mmacosx-version-min=11.0',
      '-framework',
      'CoreFoundation',
      '-framework',
      'IOKit',
      '-o',
      output,
      path.join(root, 'native', 'sleep-assertion.c'),
    ],
    { stdio: 'inherit' },
  );

  return output;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const arch = process.argv[2] ?? process.arch;
  console.log(`built ${buildSleepAssertion(arch)} for ${arch}`);
}
