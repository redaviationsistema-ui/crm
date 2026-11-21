import test from 'node:test'
import assert from 'node:assert/strict'
import { vDialogoModal } from '../src/compartido/directivas/dialogoModal.js'
import { cerrarMenuConEscape } from '../src/compartido/utilidades/cerrarMenuConEscape.js'

test('el ciclo de vida abre y cierra el diálogo mediante su API modal', () => {
  const operaciones = []
  const dialogo = {
    open: false,
    showModal() { this.open = true; operaciones.push('abrir') },
    close() { this.open = false; operaciones.push('cerrar') },
  }
  vDialogoModal.mounted(dialogo)
  assert.equal(dialogo.open, true)
  vDialogoModal.beforeUnmount(dialogo)
  vDialogoModal.beforeUnmount(dialogo)
  assert.deepEqual(operaciones, ['abrir', 'cerrar'])
})

test('Escape cierra el menú abierto y devuelve el foco al resumen', () => {
  const acciones = []
  const menu = {
    open: true,
    querySelector(selector) {
      assert.equal(selector, 'summary')
      return { focus: () => acciones.push('foco') }
    },
  }
  const evento = {
    currentTarget: menu,
    preventDefault: () => acciones.push('prevenir'),
    stopPropagation: () => acciones.push('detener'),
  }
  cerrarMenuConEscape(evento)
  assert.equal(menu.open, false)
  cerrarMenuConEscape(evento)
  assert.deepEqual(acciones, ['prevenir', 'detener', 'foco'])
})
