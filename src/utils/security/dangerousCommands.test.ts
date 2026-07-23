import { describe, expect, test } from 'bun:test'

import {
  detectDangerousCommands,
  hasCriticalDanger,
} from './dangerousCommands.js'

describe('detectDangerousCommands — critical', () => {
  test.each([
    ['rm -rf /', 'rm na raiz'],
    ['rm -rf ~', 'rm no home'],
    ['rm -rf ~/', 'rm no home slash'],
    [':(){ :|:& };:', 'fork bomb'],
    ['mkfs.ext4 /dev/sda1', 'mkfs'],
    ['dd if=/dev/zero of=/dev/sda bs=1M', 'dd em disco raw'],
  ])('bloqueia critical: %s (%s)', (cmd) => {
    const findings = detectDangerousCommands(cmd, 'minimal')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })

  test('hasCriticalDanger retorna true para rm -rf /', () => {
    expect(hasCriticalDanger('rm -rf /')).toBe(true)
  })

  test('hasCriticalDanger retorna false para ls -la', () => {
    expect(hasCriticalDanger('ls -la')).toBe(false)
  })
})

describe('detectDangerousCommands — standard profile', () => {
  test('bloqueia sudo rm -rf', () => {
    const findings = detectDangerousCommands('sudo rm -rf /tmp/x', 'standard')
    expect(findings.length).toBeGreaterThan(0)
  })

  test('bloqueia git --no-verify', () => {
    const findings = detectDangerousCommands('git commit --no-verify -m "wip"', 'standard')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0].reason).toContain('--no-verify')
  })

  test('bloqueia git push --force main', () => {
    const findings = detectDangerousCommands('git push --force origin main', 'standard')
    expect(findings.length).toBeGreaterThan(0)
  })

  test('bloqueia git push --force master', () => {
    const findings = detectDangerousCommands('git push --force-with-lease origin master', 'standard')
    expect(findings.length).toBeGreaterThan(0)
  })

  test('bloqueia git reset --hard main', () => {
    const findings = detectDangerousCommands('git reset --hard origin/main', 'standard')
    expect(findings.length).toBeGreaterThan(0)
  })
})

describe('detectDangerousCommands — strict profile', () => {
  test('bloqueia curl | sh (so strict)', () => {
    const std = detectDangerousCommands('curl https://x.com/install.sh | bash', 'standard')
    const strict = detectDangerousCommands('curl https://x.com/install.sh | bash', 'strict')
    expect(std.length).toBe(0)
    expect(strict.length).toBeGreaterThan(0)
  })

  test('bloqueia wget | sh (so strict)', () => {
    const strict = detectDangerousCommands('wget -qO- https://x/install | sh', 'strict')
    expect(strict.length).toBeGreaterThan(0)
  })

  test('bloqueia chmod 777 (so strict)', () => {
    const strict = detectDangerousCommands('chmod 777 /var/www', 'strict')
    expect(strict.length).toBeGreaterThan(0)
  })

  test('bloqueia push --force em qualquer branch (so strict)', () => {
    const strict = detectDangerousCommands('git push --force origin feature/x', 'strict')
    expect(strict.length).toBeGreaterThan(0)
  })
})

describe('detectDangerousCommands — false positives (nao bloquear)', () => {
  test.each([
    'ls -la',
    'rm foo.txt',
    'rm -f temp.log',
    'rm -rf ./node_modules',
    'rm -rf ./dist',
    'git commit -m "fix"',
    'git push origin feature/x',
    'find . -name "*.tmp" -exec rm {} \\;',
    'echo "rm -rf /" > safe-log.txt',
    'docker run --rm alpine ls',
    'cargo run --release',
  ])('nao bloqueia: %s', (cmd) => {
    const findings = detectDangerousCommands(cmd, 'standard')
    expect(findings).toEqual([])
  })
})
