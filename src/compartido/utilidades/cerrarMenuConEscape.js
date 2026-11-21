export function cerrarMenuConEscape(evento) {
  const menu = evento.currentTarget
  if (!menu.open) return

  evento.preventDefault()
  evento.stopPropagation()
  menu.open = false
  menu.querySelector('summary')?.focus()
}
