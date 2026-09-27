#!/usr/bin/env node
/**
 * Reads the local .env file and pushes all non-redacted variables to the
 * linked Vercel project via the Vercel API, storing them as encrypted secrets.
 * Only variable NAMES and success/FAIL status are printed — never values.
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
const projectJsonPath = path.resolve(__dirname, '..', '.vercel', 'project.json');

// Read project linkage
let projectId, teamId;
try {
  const pj = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  projectId = pj.projectId;
  teamId = pj.orgId;
} catch (e) {
  console.error('Cannot read .vercel/project.json — is the project linked?');
  process.exit(1);
}

// Parse .env
const content = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!value) continue;
  envVars[key] = value;
}

// List existing env vars on the project, then delete them all for a clean slate
let existingVars = [];
try {
  const listResult = execSync(
    `npx vercel api /v3/projects/${projectId}/env?teamId=${teamId}`,
    { encoding: 'utf8', timeout: 15000 }
  );
  existingVars = JSON.parse(listResult);
} catch (e) {
  console.log('Could not list existing env vars, continuing...');
}

// Delete existing vars
for (const v of existingVars) {
  try {
    execSync(
      `npx vercel api /v3/projects/${projectId}/env/${v.id}?teamId=${teamId} --dangerously-skip-permissions -X DELETE`,
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    );
    console.log(`Deleted existing: ${v.key}`);
  } catch (e) {
    console.log(`Could not delete ${v.key}: already gone or error`);
  }
}

// Set each env var as an encrypted secret
let ok = 0, failed = 0, skipped = 0;

for (const [key, value] of Object.entries(envVars)) {
  if (value.includes('⟦SECRET_REDACTED⟧')) {
    console.log(`${key}: SKIPPED (locally redacted — set manually in Vercel dashboard)`);
    skipped++;
    continue;
  }

  const body = JSON.stringify({ key, value, target: ['preview', 'production'], type: 'encrypted' });
  const cmd = `npx vercel api /v3/projects/${projectId}/env?teamId=${teamId} -X POST --input -`;

  try {
    const result = execSync(cmd, {
      input: body,
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Parse and find the var we just created (last in the list)
    const vars = JSON.parse(result);
    const created = vars.find(v => v.key === key);
    if (created) {
      console.log(`${key}: OK (type=${created.type}, uid=${created.id.slice(0,8)}...)`);
      ok++;
    } else {
      console.log(`${key}: CHECK (response: ${result.trim().slice(0,100)})`);
      ok++;
    }
  } catch (e) {
    const errStr = e.stderr ? e.stderr.toString().trim().slice(0, 200) : e.message.slice(0, 200);
    // Don't print the error if it contains the secret value
    if (errStr.includes(value)) {
      console.log(`${key}: FAILED (see error in Vercel CLI)`);
    } else {
      console.log(`${key}: FAILED (${errStr})`);
    }
    failed++;
  }
}

console.log(`\n--- Summary: ${ok} set, ${failed} failed, ${skipped} skipped ---`);
