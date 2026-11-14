import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('el servicio no registra payloads de llamadas ni seguimientos', () => {
  const source = fs.readFileSync('src/services/crmSupabaseService.js', 'utf8')

  assert.doesNotMatch(source, /console\.log\s*\(/)
  assert.doesNotMatch(source, /PAYLOAD (?:LLAMADA|SEGUIMIENTO)/)
})
