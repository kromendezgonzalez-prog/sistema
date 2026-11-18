import { hoyBogota, type FirmaFotoResponse } from '@merca/shared';
import { Router } from 'express';
import { z } from 'zod';
import { validarBody } from '../middleware/validar.js';
import { auditar } from '../services/auditoria.js';
import { cloudinaryConfigurado, firmarSubida } from '../services/cloudinary.js';
import { HttpError, ah } from '../utils/errores.js';

const router = Router();

const FirmaSchema = z.object({ contexto: z.enum(['novedad', 'gondola']) });

/* POST /fotos/firma */
router.post(
  '/firma',
  validarBody(FirmaSchema),
  ah(async (req, res) => {
    if (!cloudinaryConfigurado())
      throw new HttpError(503, 'La subida de fotos no está configurada en el servidor. Avisa a la administradora.', 'INTERNO');
    const yo = req.usuario!;
    const { contexto } = req.body as z.infer<typeof FirmaSchema>;
    const folder = `mercaimpulso/${hoyBogota()}/${yo.usuario}`;
    const body: FirmaFotoResponse = firmarSubida(folder);
    await auditar(req, {
      accion: 'FOTO_SUBIDA',
      entidad: 'foto',
      entidadId: folder,
      resumen: `Solicitó subir foto de ${contexto === 'novedad' ? 'novedad' : 'góndola'} en ${folder}`,
    });
    res.json(body);
  }),
);

export default router;
