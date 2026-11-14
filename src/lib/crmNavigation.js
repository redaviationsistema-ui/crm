export const ROLE_LABELS = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  ejecutivo: 'Ejecutivo',
}

export const menuPorRol = {
  ejecutivo: [
    { id: 'panel', label: 'Inicio', ruta: '/', icono: '◫' },
    { id: 'contactos', label: 'Contactos', ruta: '/contactos', icono: '◩' },
    { id: 'oportunidades', label: 'Oportunidades', ruta: '/oportunidades', icono: '◫' },
    { id: 'cotizaciones', label: 'Cotizaciones', ruta: '/cotizaciones', icono: '▤' },
    { id: 'llamadas', label: 'Mis llamadas', ruta: '/llamadas', icono: '☎' },
    { id: 'seguimientos', label: 'Seguimientos', ruta: '/seguimientos', icono: '◷' },
    { id: 'historial', label: 'Historial', ruta: '/historial', icono: '⎘' },
  ],
  supervisor: [
    { id: 'panel', label: 'Panel general', ruta: '/', icono: '◫' },
    { id: 'contactos', label: 'Contactos', ruta: '/contactos', icono: '◩' },
    { id: 'oportunidades', label: 'Oportunidades', ruta: '/oportunidades', icono: '◫' },
    { id: 'cotizaciones', label: 'Cotizaciones', ruta: '/cotizaciones', icono: '▤' },
    { id: 'llamadas', label: 'Llamadas', ruta: '/llamadas', icono: '☎' },
    { id: 'seguimientos', label: 'Seguimientos', ruta: '/seguimientos', icono: '◷' },
    { id: 'historial', label: 'Historial', ruta: '/historial', icono: '⎘' },
    { id: 'equipo', label: 'Equipo', ruta: '/equipo', icono: '⌘' },
    { id: 'reportes', label: 'Reportes', ruta: '/reportes', icono: '◲' },
  ],
  administrador: [
    { id: 'panel', label: 'Panel general', ruta: '/', icono: '◫' },
    { id: 'contactos', label: 'Contactos', ruta: '/contactos', icono: '◩' },
    { id: 'oportunidades', label: 'Oportunidades', ruta: '/oportunidades', icono: '◫' },
    { id: 'cotizaciones', label: 'Cotizaciones', ruta: '/cotizaciones', icono: '▤' },
    { id: 'llamadas', label: 'Llamadas', ruta: '/llamadas', icono: '☎' },
    { id: 'seguimientos', label: 'Seguimientos', ruta: '/seguimientos', icono: '◷' },
    { id: 'historial', label: 'Historial', ruta: '/historial', icono: '⎘' },
    { id: 'equipo', label: 'Equipo', ruta: '/equipo', icono: '⌘' },
    { id: 'reportes', label: 'Reportes', ruta: '/reportes', icono: '◲' },
    { id: 'usuarios', label: 'Usuarios', ruta: '/admin/usuarios', icono: '◧' },
    { id: 'configuracion', label: 'Configuración', ruta: '/configuracion', icono: '⚙' },
  ],
}

export function obtenerMenuPorRol(rol) {
  return menuPorRol[rol] || menuPorRol.ejecutivo
}
