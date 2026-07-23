/**
 * AgentShield-lite — Barrel exports.
 *
 * Uso tipico em hook PreToolUse:
 *
 * ```ts
 * import {
 *   detectDangerousCommands,
 *   detectSecrets,
 *   checkConfigProtection,
 *   getSecurityProfile,
 *   isSecurityFeatureDisabled,
 * } from '../utils/security/index.js'
 *
 * const profile = getSecurityProfile()
 *
 * if (!isSecurityFeatureDisabled('dangerous-commands')) {
 *   const dangers = detectDangerousCommands(bashCommand, profile)
 *   if (dangers.length > 0) throw new Error(dangers[0].reason)
 * }
 * ```
 */

export {
  type DangerousCommandFinding,
  type SecurityProfile,
  detectDangerousCommands,
  hasCriticalDanger,
} from './dangerousCommands.js'

export {
  type SecretFinding,
  detectSecrets,
  hasSecrets,
  _resetSecretWhitelistCache,
} from './secretPatterns.js'

export {
  checkConfigProtection,
  getProtectedConfigFiles,
} from './configProtection.js'

export {
  getSecurityProfile,
  isSecurityFeatureDisabled,
  _resetSecurityConfigCache,
} from './securityConfig.js'
