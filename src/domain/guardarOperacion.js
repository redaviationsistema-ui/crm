// Distingue escritura fallida de refresco fallido; una operación a la vez por instancia.
export function crearGuardadoControlado() {
  let enCurso = false
  return {
    get guardando() { return enCurso },
    async ejecutar(escribir, refrescar = async () => {}) {
      if (enCurso) return { estado: 'ocupado' }
      enCurso = true
      try {
        const valor = await escribir()
        try {
          await refrescar(valor)
          return { estado: 'guardado', valor }
        } catch {
          return { estado: 'guardado-sin-refrescar', valor }
        }
      } finally { enCurso = false }
    },
  }
}
