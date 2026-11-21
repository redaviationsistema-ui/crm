import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { buscar, cargarComponente, montar, texto } from './helpers/vueHarness.js'

const Seguimientos = await cargarComponente('src/views/SeguimientosView.vue')

test('Seguimientos muestra una categoría a la vez y conserva la acción de detalle', async () => {
  const llamada = {
    id: 'llamada-prueba',
    cliente: { nombre: 'Contacto de prueba' },
    motivo: 'Confirmar disponibilidad',
    asignadoANombre: 'Responsable de prueba',
    prioridad: 'alta',
    estado: 'pendiente',
    fechaProgramada: '2026-11-20T12:00:00Z',
  }
  const detalles = []
  const vista = montar(Seguimientos, {
    grupos: { hoy: [], proximas: [llamada], atrasadas: [], completadas: [] },
    onVerDetalle: registro => detalles.push(registro),
  })
  try {
    const botones = () => buscar(vista.root, nodo => nodo.tag === 'button')
    assert.match(texto(vista.root), /Confirmar disponibilidad/)
    botones().find(nodo => texto(nodo) === 'Ver detalle').props.onClick()
    assert.deepEqual(detalles, [llamada])
    botones().find(nodo => texto(nodo).includes('Atrasados')).props.onClick()
    await nextTick()
    assert.doesNotMatch(texto(vista.root), /Confirmar disponibilidad/)
    assert.equal(buscar(vista.root, nodo => nodo.props.class === 'estado-vacio').length, 1)
  } finally {
    vista.unmount()
  }
})
