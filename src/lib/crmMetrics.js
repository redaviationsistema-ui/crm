// Counts only the supplied records. A result label is not evidence of an answer.
export function contarRespuestasLlamadas(llamadas = []) {
  return llamadas.reduce(
    (conteos, llamada) => {
      conteos.registradas += 1
      if (llamada.contesto === true) conteos.contestadas += 1
      else if (llamada.contesto === false) conteos.noContestadas += 1
      return conteos
    },
    { registradas: 0, contestadas: 0, noContestadas: 0 },
  )
}
