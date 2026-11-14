// Construye PATCH parciales para el servicio de contactos.
// No aplica la normalización histórica que elimina prefijos internacionales.
export function crearCambiosContacto(cambios = {}) {
  const payload = {}
  const campos = {
    nombre: 'nombre', apellidos: 'apellidos', empresa: 'empresa', cargo: 'cargo',
    telefono: 'telefono', whatsapp: 'whatsapp', correo: 'correo', tipoMercado: 'tipo_mercado',
    pais: 'pais', estado: 'estado', ciudad: 'ciudad', fabricanteInteres: 'fabricante_interes',
    modeloInteres: 'modelo_interes', moneda: 'moneda', prioridad: 'prioridad',
    usuarioResponsableId: 'usuario_responsable_id', notas: 'notas',
  }
  for (const [origen, destino] of Object.entries(campos)) {
    if (!Object.hasOwn(cambios, origen) || cambios[origen] === undefined) continue
    const valor = cambios[origen]
    if (valor != null && typeof valor !== 'string') throw new Error(`Campo invalido: ${origen}`)
    const limpio = valor?.trim() || null
    if (['nombre', 'telefono'].includes(origen) && !limpio) throw new Error(`Campo obligatorio: ${origen}`)
    payload[destino] = origen === 'correo' ? limpio?.toLowerCase() ?? null : limpio
  }
  if (Object.hasOwn(cambios, 'presupuesto') && cambios.presupuesto !== undefined) {
    const valor = cambios.presupuesto
    const numero = valor === '' || valor == null ? null : Number(valor)
    if (numero !== null && (typeof valor === 'boolean' || !Number.isFinite(numero) || numero < 0)) {
      throw new Error('Presupuesto invalido')
    }
    payload.presupuesto = numero
  }
  // Validación, autorización de responsable y deduplicación final pertenecen al servidor.
  return payload
}
