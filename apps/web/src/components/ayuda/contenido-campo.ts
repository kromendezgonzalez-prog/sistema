import type { TemaAyuda } from './Ayuda';

/** Contenido de ayuda de las pantallas de campo (mercaimpulsadoras). */
export const AYUDA_CAMPO: Record<string, TemaAyuda> = {
  general: {
    titulo: 'Cómo usar Mercaimpulso',
    intro: 'Con esta app registras tu gestión diaria en el punto de venta: inventario por lotes, góndola, competencia e impulso.',
    pasos: [
      { titulo: 'Inicio', texto: 'Ves tus puntos de venta y el estado del día. Toca "Iniciar conteo" al llegar.' },
      { titulo: 'Registrar', texto: 'Confirma tu ubicación, cuenta los lotes y llena las secciones. Toca "Guardar".' },
      { titulo: 'Registros', texto: 'Revisa lo que enviaste y corrige hasta 3 días atrás.' },
      { titulo: 'Botón "?"', texto: 'En cada pantalla te explica qué hacer, con ejemplos.' },
    ],
    faq: [
      { p: '¿Qué pasa si no tengo señal?', r: 'Sigue trabajando normal. Todo se guarda en el celular y se envía solo cuando vuelve la señal.' },
      { p: '¿Puedo ver el tour de bienvenida otra vez?', r: 'Sí: en Inicio toca "Ver tour", arriba a la derecha.' },
    ],
  },

  login: {
    titulo: 'Iniciar sesión',
    intro: 'Entra con el usuario y la contraseña que te dio tu supervisora.',
    pasos: [
      { titulo: 'Escribe tu usuario', texto: 'En minúsculas, sin espacios (ej. maria.gomez). El celular lo recuerda para la próxima vez.' },
      { titulo: 'Escribe tu contraseña', texto: 'Toca el ojo 👁 para verla mientras la escribes.' },
      { titulo: 'Primera vez', texto: 'Te pedirá cambiar la contraseña temporal por una tuya de mínimo 6 caracteres.' },
    ],
    faq: [
      { p: 'Olvidé mi contraseña', r: 'Nadie puede verla, ni administración. Pide que te la reseteen: te darán una temporal y la cambias al entrar.' },
      { p: 'Dice "usuario bloqueado"', r: 'Pasa después de 5 intentos fallidos. Espera 15 minutos o pide a administración que te desbloquee.' },
      { p: 'Dice "usuario inactivo"', r: 'Tu usuario fue desactivado. Habla con tu supervisora.' },
      { p: '¿Necesito señal para entrar?', r: 'La primera vez sí. Después, si ya habías entrado en este celular, la app abre aunque no haya señal.' },
    ],
  },

  inicio: {
    titulo: 'Inicio',
    intro: 'Aquí ves tus puntos de venta asignados y cómo va tu día.',
    pasos: [
      { titulo: 'Iniciar conteo', texto: 'Toca el botón grande del punto donde estás. La app elige el turno según la hora; puedes cambiarlo.' },
      { titulo: 'Estado del día', texto: '"Falta cierre" significa que guardaste al llegar y te falta contar lo que quedó al final. Toca "Completar cierre".' },
      { titulo: 'Lotes en riesgo', texto: 'Muestra lo que está por vencer en tus puntos según el último conteo, del más urgente al menos urgente.' },
      { titulo: 'Guardados en el celular', texto: 'Si aparece el aviso amarillo, hay registros esperando señal. Se envían solos.' },
    ],
  },

  'registrar.jornada': {
    titulo: 'Paso 1: Jornada',
    intro: 'Le dice al sistema qué día, qué turno y en qué punto estás trabajando.',
    pasos: [
      { titulo: 'Fecha', texto: 'Normalmente es hoy. Puedes registrar o corregir hasta 3 días atrás.' },
      { titulo: 'Turno', texto: 'Mañana, Tarde o Completa. Cada turno en cada punto es un registro aparte.' },
      { titulo: 'Tipo de día', texto: 'Si es descanso, festivo, incapacidad, capacitación o vacaciones, márcalo aquí: solo te pedirá una nota.' },
      { titulo: 'Punto de venta', texto: 'Elígelo de la lista. Tus puntos asignados aparecen primero.' },
    ],
    faq: [
      { p: '¿Por qué tengo que marcar el descanso?', r: 'Así sabemos que no es un día sin reporte, sino un día sin trabajo en punto.' },
      { p: 'Ya había guardado este turno', r: 'La app lo abre para que lo edites. Los cambios actualizan el mismo registro.' },
    ],
  },

  'registrar.gps': {
    titulo: 'Ubicación (check-in)',
    intro:
      'Para registrar un día laboral la app confirma que estás en el punto. Toma tu ubicación una sola vez, no te sigue durante el día.',
    pasos: [
      { titulo: 'Toca "Tomar mi ubicación"', texto: 'Si el celular pregunta, toca "Permitir".' },
      { titulo: 'Verde: estás en el punto', texto: 'Estás a menos de 300 m del almacén. Sigue con el inventario.' },
      { titulo: 'Amarillo: fuera de rango', texto: 'Puedes continuar, pero el registro queda marcado. Si sí estás en el punto, acércate a la entrada y toca "Actualizar ubicación".' },
      { titulo: 'Rojo: sin permiso o GPS apagado', texto: 'Sigue los pasos que aparecen en pantalla y toca "Reintentar". Sin ubicación no se puede guardar un día laboral.' },
    ],
    faq: [
      { p: 'Estoy dentro de la nevera y no encuentra el GPS', r: 'Sal un momento a la entrada del almacén o cerca de una ventana. Después puedes volver a contar.' },
      { p: 'Dice "punto sin ubicación fijada"', r: 'Es normal mientras administración no haya guardado las coordenadas del punto. Tu ubicación se guarda igual.' },
      { p: '¿Gasta mucha batería?', r: 'No. Solo se usa unos segundos al iniciar el conteo.' },
    ],
  },

  'registrar.lotes': {
    titulo: 'Inventario por lotes',
    intro:
      'Un lote es una pieza o un grupo de paquetes del mismo producto con la misma fecha de vencimiento. Se registran al llegar y al cierre.',
    pasos: [
      { titulo: 'Al llegar', texto: 'Los lotes vienen precargados con el último cierre del punto. Revisa la nevera: confirma, corrige la cantidad o fecha, quita lo que ya no está y agrega lo nuevo.' },
      { titulo: 'Durante el turno', texto: '"Recibido" es el pedido que llegó; "Avería" lo dañado o devuelto; "Agotado" si en algún momento no hubo producto para el cliente.' },
      { titulo: 'Al cierre', texto: 'Toca "Copiar lotes de llegada" y solo ajusta lo que se vendió. Si no quedó nada, toca "No quedó (0)".' },
      { titulo: 'La venta se calcula sola', texto: 'Venta = inicial + recibido − final − avería.' },
      { titulo: 'Colores de vencimiento', texto: 'Cada lote muestra al instante su nivel: Medio, Crítico, Emergencia o Vencido. Toca "?" en "Niveles de riesgo" para saber qué hacer.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos',
      texto:
        'Punta de anca: en la nevera hay 5 piezas → son 5 lotes. Pesa cada una y escribe su peso con su fecha: 1,2 kg vence 20-nov; 1,4 kg vence 20-nov; 1,1 kg vence 22-nov… (la fecha se conserva para el siguiente lote, así escribes menos).\n\nPaquetes de 500 g: si hay 8 paquetes que vencen el 25-nov y 4 que vencen el 28-nov → son 2 lotes: "8 und · 25-nov" y "4 und · 28-nov". Los paquetes se cuentan por unidades, no por kilos.',
    },
    faq: [
      { p: '¿Qué hago si no había producto al llegar?', r: 'Toca "No había (0)". Es distinto a dejarlo sin registrar.' },
      { p: 'Me equivoqué y borré un lote', r: 'Justo después de quitarlo aparece "Deshacer" abajo de la pantalla.' },
      { p: 'Un paquete no tiene fecha', r: 'Al agregar el lote marca "Sin fecha legible" y luego toca "Reportar novedad" en ese lote.' },
      { p: 'Sale un aviso rojo', r: 'Revisa el dato (por ejemplo, venta negativa o una fecha mal escrita). Si está bien, puedes guardar igual confirmando dos veces.' },
      { p: '¿Y si el punto tiene portafolio?', r: 'Solo verás los productos de ese punto. Usa el buscador por nombre o código.' },
    ],
  },

  'registrar.novedad': {
    titulo: 'Reportar novedad de un lote',
    intro: 'Úsalo cuando un lote tiene un problema: vacío perdido, empaque roto, cambio de color u olor, golpe, etiqueta ilegible o sin fecha.',
    pasos: [
      { titulo: 'Toca "Reportar novedad" en el lote', texto: 'Cada lote tiene su propio botón.' },
      { titulo: 'Elige qué pasó', texto: 'Escoge el tipo de novedad.' },
      { titulo: 'Escribe una nota corta', texto: 'Qué viste y a quién le informaste en el almacén.' },
      { titulo: 'Toma la foto', texto: 'Se abre la cámara. Hasta 3 fotos por lote. Si no hay señal, quedan en el celular y se suben después.' },
    ],
    faq: [
      { p: 'El lote está vencido', r: 'Retíralo de la góndola y repórtalo aquí. Es obligatorio reportar novedad de los lotes vencidos.' },
      { p: 'La foto dice "En el celular"', r: 'Aún no se ha subido por falta de señal. Se sube sola al guardar o al volver la señal.' },
    ],
  },

  'registrar.gondola': {
    titulo: 'Góndola y precio',
    pasos: [
      { titulo: 'Exhibición', texto: '¿El producto está exhibido como se acordó con el almacén? Sí, Parcial o No.' },
      { titulo: 'Frentes', texto: 'Cuenta las caras de producto LOMUS al frente de la góndola y las de la competencia.' },
      { titulo: 'Temperatura', texto: 'Mira el termómetro de la nevera. Más de 4,4 °C es una falla de frío: avisa y repórtalo en Novedades.' },
      { titulo: 'Precio y POP', texto: '¿El precio LOMUS está bien marcado? ¿El material publicitario está instalado?' },
      { titulo: 'Fotos (opcional)', texto: 'Hasta 5 fotos de la góndola como evidencia.' },
    ],
    faq: [{ p: 'Me equivoqué al tocar una opción', r: 'Tócala otra vez para quitarla.' }],
  },

  'registrar.competencia': {
    titulo: 'Competencia',
    intro: 'Marca solo las marcas que viste hoy en el punto.',
    pasos: [
      { titulo: 'Toca la marca', texto: 'Se abren los campos de precio y actividad.' },
      { titulo: 'Precio por kg', texto: 'De un corte comparable (por ejemplo, costilla), en pesos, sin puntos.' },
      { titulo: 'Actividad', texto: 'Si tenían impulsadora, degustación, precio promocional o exhibición adicional.' },
    ],
  },

  'registrar.impulso': {
    titulo: 'Impulso al cliente',
    pasos: [
      { titulo: 'Abordados', texto: 'Personas a las que les ofreciste o explicaste el producto.' },
      { titulo: 'Degustaciones', texto: 'Personas que probaron.' },
      { titulo: 'Compras', texto: 'Personas que compraron producto LOMUS después de tu impulso.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo',
      texto: 'Abordaste 40 personas y 8 compraron → la conversión es 20 % (8 ÷ 40). La meta del equipo es 15 %.',
    },
  },

  'registrar.guardar': {
    titulo: 'Novedades y guardar',
    pasos: [
      { titulo: 'Novedades del día', texto: 'Marca lo que pasó (puedes marcar varias) y escribe en Observaciones a quién le informaste.' },
      { titulo: 'Toca "Guardar"', texto: 'Verás un resumen: alertas en rojo, lotes urgentes, fotos por subir y tu ubicación.' },
      { titulo: 'Confirma', texto: 'Si hay alertas en rojo, la app te pregunta dos veces para que revises.' },
      { titulo: 'Guardar al llegar y completar al cierre', texto: 'Puedes guardar apenas termines el conteo de llegada y volver al final del turno con "Completar cierre". Es el mismo registro.' },
    ],
    faq: [
      { p: 'Sin señal, ¿se pierde?', r: 'No. Queda guardado en el celular y se envía solo. Verás "Guardado en el celular".' },
      { p: 'Cerré la app sin guardar', r: 'Lo que llevabas se guarda solo en el celular. Al volver a Registrar, sigues donde ibas.' },
    ],
  },

  offline: {
    titulo: 'Trabajar sin señal',
    intro: 'La app funciona aunque no haya internet (por ejemplo, dentro de la nevera).',
    pasos: [
      { titulo: 'Registra normal', texto: 'El conteo, la ubicación y las fotos se guardan en el celular.' },
      { titulo: 'Guarda', texto: 'Aparece "Guardado en el celular, se enviará cuando haya señal".' },
      { titulo: 'Se envía solo', texto: 'Al volver la señal, al abrir la app y cada minuto mientras haya pendientes.' },
      { titulo: 'Aviso amarillo', texto: 'Arriba verás "N registros sin enviar". Puedes tocar "Reintentar".' },
    ],
    faq: [
      { p: 'Aparece un aviso rojo "con datos por corregir"', r: 'El servidor no aceptó ese registro. Ve a "Registros", tócalo, corrige y guarda otra vez.' },
      { p: '¿Puedo cerrar sesión con pendientes?', r: 'Mejor no: espera a que se envíen. Los pendientes son de tu usuario.' },
    ],
  },

  'mis-registros': {
    titulo: 'Mis registros',
    intro: 'Tus últimos 60 registros, agrupados por día, más los que están en el celular sin enviar.',
    pasos: [
      { titulo: 'Enviado ✓', texto: 'Ya está en el sistema.' },
      { titulo: 'Pendiente ⏳', texto: 'Está en el celular esperando señal. Se envía solo.' },
      { titulo: 'Error ✕', texto: 'Tiene algo por corregir. Tócalo, corrige y guarda de nuevo.' },
      { titulo: 'Editar', texto: 'Puedes abrir y corregir los registros de los últimos 3 días. Los más antiguos solo se pueden ver.' },
    ],
    faq: [
      { p: '¿Qué significa "Fuera de rango"?', r: 'La ubicación se tomó a más de 300 m del punto. Queda visible para tu supervisora.' },
    ],
  },

  'niveles-riesgo': {
    titulo: 'Niveles de riesgo de vencimiento',
    intro: 'Cada lote toma un color según los días que le faltan para vencer (contando desde hoy).',
    pasos: [
      { titulo: '! Medio (8 a 10 días)', texto: 'Rota FEFO: lo que vence primero va adelante en la góndola.' },
      { titulo: '⚠ Crítico (6 a 7 días)', texto: 'Impulso y degustación prioritaria; producto al frente.' },
      { titulo: '✕ Emergencia – Salida (0 a 5 días)', texto: 'Gestiona la salida hoy: retirar o liquidar con la tienda.' },
      { titulo: '⛔ Vencido', texto: 'Retiro inmediato de la góndola y reporta la novedad del lote.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo',
      texto: 'Hoy es 16-nov. Un lote que vence el 21-nov tiene 5 días → Emergencia (rojo). Uno que vence el 25-nov tiene 9 días → Medio (amarillo).',
    },
    faq: [{ p: '¿Quién define los días?', r: 'Administración. Los valores por defecto son: Medio ≤ 10, Crítico ≤ 7, Emergencia ≤ 5 días.' }],
  },
};
