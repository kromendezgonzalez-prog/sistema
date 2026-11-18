import type { TemaAyuda } from './Ayuda';

/** Contenido de ayuda de tablero y administración (agente Frontend-Admin). */
export const AYUDA_ADMIN: Record<string, TemaAyuda> = {
  tablero: {
    titulo: 'Cómo leer el tablero',
    intro:
      'El tablero resume lo que el equipo registró en el periodo elegido. Los números vienen calculados del servidor con los registros guardados.',
    pasos: [
      {
        titulo: 'Elige el periodo',
        texto:
          'Toca Hoy, 7, 14, 30 días, Mes actual o 90 días. Supervisión y administración también pueden filtrar por persona y por punto.',
      },
      {
        titulo: 'Mira los semáforos',
        texto:
          '✓ En meta (verde), ! Atención (ámbar) y ✕ Crítico (rojo). Siempre llevan ícono y texto, no solo color.',
      },
      {
        titulo: 'Atiende los vencimientos',
        texto:
          'En “Riesgo de vencimiento” toca un nivel para ver solo esos lotes. La lista “Acción hoy” dice qué hacer con cada uno.',
      },
      {
        titulo: 'Revisa el reporte',
        texto:
          'En “Cumplimiento de reporte” ves quién reportó hoy, los días sin reporte y el último registro de cada persona.',
      },
      {
        titulo: 'Check-ins',
        texto:
          'Cada conteo guarda la ubicación. Los marcados “✕ Fuera de rango” se hicieron lejos del punto: toca “Ver en mapa” para revisar.',
      },
      {
        titulo: 'Descarga el Excel',
        texto:
          'El botón “Descargar Excel” baja una fila por lote y producto del periodo, para análisis en Excel.',
      },
    ],
    ejemplo: {
      titulo: 'Ejemplo',
      texto:
        'Días de inventario = 6 con meta ≤ 4 → ! Atención. Significa que hay producto para 6 días de venta: conviene pedir menos o impulsar esa referencia.',
    },
    faq: [
      {
        p: '¿Por qué no coincide con mi cálculo?',
        r: 'El tablero excluye filas con venta negativa (aparecen como “Inconsistencias”) y suma todo en kg equivalentes.',
      },
      {
        p: '¿Qué es “und sin peso”?',
        r: 'Productos por unidad sin peso configurado. Su venta no se puede sumar en kg; administración debe completar el peso en el catálogo.',
      },
      {
        p: '¿Cada cuánto se actualiza?',
        r: 'Cada vez que abres el tablero o cambias un filtro. Los registros hechos sin señal aparecen cuando se sincronizan.',
      },
    ],
  },

  indicadores: {
    titulo: 'Indicadores',
    intro:
      'Aquí está la definición de cada indicador, sus metas actuales y los niveles de riesgo de vencimiento.',
    pasos: [
      {
        titulo: 'Resultado',
        texto: 'Sell-out, inventario, días de inventario y merma: dicen qué pasó.',
      },
      {
        titulo: 'Ejecución',
        texto:
          'Disponibilidad, share of shelf, exhibición, precio y conversión: son los que la mercaimpulsadora puede mover cada día.',
      },
      {
        titulo: 'Metas',
        texto:
          'Las metas las define administración en “Metas y riesgo” y se aplican a todo el equipo.',
      },
    ],
  },

  admin: {
    titulo: 'Panel de administración',
    intro: 'Desde aquí configuras la app para todo el equipo.',
    pasos: [
      {
        titulo: 'Usuarios',
        texto: 'Crea a cada trabajadora, asígnale sus puntos y resetea su contraseña si la olvida.',
      },
      {
        titulo: 'Puntos de venta',
        texto:
          'Completa ciudad, cadena y portafolio, y fija la ubicación GPS estando en la tienda.',
      },
      { titulo: 'Catálogo', texto: 'Referencias, unidad (kg o und) y peso por unidad.' },
      {
        titulo: 'Metas y riesgo',
        texto:
          'Metas de los indicadores, días de cada nivel de vencimiento, marcas de competencia y tipos de novedad.',
      },
      {
        titulo: 'Auditoría',
        texto: 'Historial de todo lo que pasa: ingresos, registros, cambios y descargas.',
      },
      {
        titulo: 'Backup',
        texto: 'Descarga un Excel con toda la información. Hazlo al menos una vez por semana.',
      },
    ],
  },

  'admin.usuarios': {
    titulo: 'Usuarios',
    intro:
      'Cada persona entra con su propio usuario y contraseña. Nadie puede ver las contraseñas, ni siquiera administración.',
    pasos: [
      {
        titulo: 'Crear',
        texto:
          'Toca “Nuevo usuario”, escribe el nombre (el usuario se sugiere solo), elige el rol y marca sus puntos.',
      },
      {
        titulo: 'Entregar la contraseña',
        texto:
          'Al crear aparece una contraseña temporal UNA sola vez. Cópiala y entrégasela a la trabajadora; al entrar deberá cambiarla.',
      },
      {
        titulo: 'Si la olvida',
        texto:
          'Toca “Resetear contraseña”: se genera una temporal nueva y la anterior deja de servir. También desbloquea al usuario.',
      },
      {
        titulo: 'Desactivar',
        texto:
          'Si alguien deja el equipo, desactívalo en “Editar”. Sus registros se conservan. No puedes desactivarte a ti misma.',
      },
    ],
    faq: [
      {
        p: '¿Por qué aparece “Bloqueado”?',
        r: 'Tras 5 intentos fallidos el usuario se bloquea 15 minutos. Puedes esperar o resetear la contraseña.',
      },
      {
        p: '¿Qué ve cada rol?',
        r: 'Mercaimpulsadora: registra en sus puntos y ve su tablero. Supervisión: ve el tablero de todo el equipo y la galería. Administración: todo.',
      },
      {
        p: 'Cerré la ventana sin copiar la contraseña',
        r: 'No hay problema: vuelve a tocar “Resetear contraseña” para generar otra.',
      },
    ],
  },

  'admin.puntos': {
    titulo: 'Puntos de venta y ubicación',
    intro:
      'La ubicación del punto permite comprobar que cada conteo se hace en la tienda (dentro del radio, normalmente 300 m).',
    pasos: [
      {
        titulo: 'Ve a la tienda',
        texto: 'Con el celular, párate dentro de la tienda, cerca de la nevera de LOMUS.',
      },
      { titulo: 'Abre el punto', texto: 'En “Puntos de venta” toca “Editar” en el punto.' },
      {
        titulo: 'Fija la ubicación',
        texto:
          'Toca “Fijar con mi ubicación actual” y acepta el permiso de ubicación. Revisa la precisión y confirma.',
      },
      {
        titulo: 'Sin estar allá',
        texto:
          'También puedes escribir latitud y longitud a mano (cópialas de Google Maps: mantén presionado el punto en el mapa).',
      },
    ],
    ejemplo: {
      titulo: 'Precisión',
      texto:
        'Si la precisión dice ±80 m, acércate a una ventana o a la entrada y vuelve a intentar. Lo ideal es ±30 m o menos.',
    },
    faq: [
      {
        p: '¿Qué es el portafolio?',
        r: 'Los productos que maneja ese punto. Si no marcas ninguno, al registrar aparecen todos los productos activos.',
      },
      {
        p: '¿Qué pasa si un punto no tiene ubicación?',
        r: 'Los conteos se guardan igual, pero no se puede saber si se hicieron en el punto (aparecen como “Punto sin ubicación”).',
      },
    ],
  },

  'admin.productos': {
    titulo: 'Catálogo de productos',
    pasos: [
      {
        titulo: 'Unidad',
        texto:
          '“Por kilo” para cortes que se pesan; “Por unidad” para paquetes o bandejas que se cuentan.',
      },
      {
        titulo: 'Peso por unidad',
        texto:
          'Para productos por unidad, escribe cuánto pesa cada una (paquete de 500 g = 0,5). Así su venta se suma en kg.',
      },
      {
        titulo: 'Desactivar',
        texto:
          'Si una referencia sale, desactívala: deja de aparecer para registrar pero su historial se conserva.',
      },
    ],
    faq: [
      {
        p: '¿Qué significa “und sin peso”?',
        r: 'Es un producto por unidad sin peso: su venta no entra en los kg del tablero hasta que completes el peso.',
      },
    ],
  },

  'admin.config': {
    titulo: 'Metas y riesgo',
    intro: 'Estos valores se aplican a todo el equipo apenas guardas.',
    pasos: [
      {
        titulo: 'Metas',
        texto:
          'Escribe los porcentajes como los dices: 2 para 2 %, 95 para 95 %. Días de inventario en días.',
      },
      {
        titulo: 'Umbrales de vencimiento',
        texto:
          'Días que faltan para vencer. Debe cumplirse Medio > Crítico > Emergencia. La vista previa muestra cómo quedan los niveles.',
      },
      {
        titulo: 'Listas',
        texto:
          'Agrega, quita o reordena marcas de competencia y tipos de novedad. El orden es el que verá el equipo.',
      },
      {
        titulo: 'Guardar',
        texto: 'Cuando hay cambios aparece una barra abajo con “Guardar” y “Descartar”.',
      },
    ],
    ejemplo: {
      titulo: 'Ejemplo de umbrales',
      texto:
        'Medio 10, Crítico 7, Emergencia 5:\n• 8 a 10 días → Medio\n• 6 a 7 días → Crítico\n• 0 a 5 días → Emergencia – Salida\n• Fecha pasada → Vencido',
    },
  },

  'admin.auditoria': {
    titulo: 'Auditoría',
    intro:
      'Registro de todo lo que pasa en la app. Solo administración lo ve y nadie puede editarlo ni borrarlo.',
    pasos: [
      {
        titulo: 'Filtra',
        texto:
          'Por fechas, persona, tipo de acción o buscando una palabra (por ejemplo el nombre de un punto).',
      },
      {
        titulo: 'Abre el detalle',
        texto:
          'Toca un evento para ver qué cambió (antes → después), la IP, el dispositivo y, si hay, la ubicación.',
      },
    ],
    faq: [
      {
        p: '¿Se puede exportar?',
        r: 'Sí: la hoja “Auditoría” viene incluida en el backup Excel del panel de administración.',
      },
      {
        p: '¿Qué es “GPS fuera de rango”?',
        r: 'Un conteo guardado lejos del punto (más allá de su radio). Se permite guardar, pero queda marcado para revisión.',
      },
    ],
  },

  'admin.backup': {
    titulo: 'Backup Excel',
    intro:
      'Descarga un solo archivo Excel con toda la información de la app, cada tabla en su propia hoja.',
    pasos: [
      {
        titulo: 'Qué trae',
        texto:
          'Registros, Detalle productos, Lotes, Novedades (con link a la foto), Usuarios (sin contraseñas), Puntos de venta, Productos, Configuración y Auditoría.',
      },
      {
        titulo: 'Cada cuánto',
        texto: 'Recomendado: una vez por semana, y siempre antes de cambios grandes.',
      },
      {
        titulo: 'Dónde guardarlo',
        texto:
          'En una carpeta segura (por ejemplo, tu Drive). Tiene datos personales del equipo: no lo compartas.',
      },
    ],
  },

  novedades: {
    titulo: 'Galería de novedades',
    intro:
      'Fotos de los lotes con novedad (vacío perdido, empaque roto, etc.) que reporta el equipo.',
    pasos: [
      { titulo: 'Filtra', texto: 'Elige el periodo, el punto y el tipo de novedad.' },
      {
        titulo: 'Ver la foto',
        texto: 'Toca una foto para verla en pantalla completa. Si hay varias, usa las flechas.',
      },
      {
        titulo: 'Actúa',
        texto: 'Con la foto puedes gestionar el cambio o la devolución con el punto de venta.',
      },
    ],
  },
};
