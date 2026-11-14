import test from 'node:test'
import assert from 'node:assert/strict'
import { contarRespuestasLlamadas } from '../src/lib/crmMetrics.js'
import { adaptarLlamadaDesdeSupabase } from '../src/adapters/crmAdapters.js'

test('sin registros no inventa respuestas', () => {
  assert.deepEqual(contarRespuestasLlamadas(), {
    registradas: 0, contestadas: 0, noContestadas: 0,
  })
})

test('un resultado de buzón no cuenta como contestada', () => {
  const llamadas = [
    { id: '1', contesto: true, resultadoId: 'interesado' },
    { id: '2', contesto: false, resultadoId: 'buzon', resultado: 'Buzón' },
    { id: '3', contesto: null, resultadoId: 'pendiente_revision' },
    { id: '4', estado: 'pendiente' },
  ]
  assert.deepEqual(contarRespuestasLlamadas(llamadas), {
    registradas: 4, contestadas: 1, noContestadas: 1,
  })
})

test('respeta el booleano aunque el texto del resultado sea contradictorio', () => {
  assert.deepEqual(contarRespuestasLlamadas([
    { contesto: true, resultado: 'No contestó; devolución posterior' },
    { contesto: false, resultado: 'Interesado' },
    { contesto: null, resultado: 'Ocupado' },
  ]), { registradas: 3, contestadas: 1, noContestadas: 1 })
})

test('no interpreta strings ni números como booleanos confirmados', () => {
  assert.deepEqual(contarRespuestasLlamadas([
    { contesto: 'true' }, { contesto: 'false' }, { contesto: 1 }, { contesto: 0 },
  ]), { registradas: 4, contestadas: 0, noContestadas: 0 })
})

test('el contrato existente del adaptador conserva respuestas y desconocidos', () => {
  const llamadas = [true, false, null].map((contesto, index) =>
    adaptarLlamadaDesdeSupabase({ id: String(index), contesto, resultado_id: 'resultado' }),
  )
  assert.deepEqual(contarRespuestasLlamadas(llamadas), {
    registradas: 3, contestadas: 1, noContestadas: 1,
  })
})

test('cuenta la muestra suministrada sin limitarla a 200 ni modificar registros', () => {
  const llamadas = Object.freeze(Array.from({ length: 251 }, (_, i) =>
    Object.freeze({ id: String(i), contesto: i % 2 === 0 }),
  ))
  assert.deepEqual(contarRespuestasLlamadas(llamadas), {
    registradas: 251, contestadas: 126, noContestadas: 125,
  })
})
