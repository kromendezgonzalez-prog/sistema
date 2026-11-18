import type { RegistroInput } from '@merca/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async () => new Blob(['jpeg-comprimido'], { type: 'image/jpeg' })),
}));

import imageCompression from 'browser-image-compression';
import { ErrorRed } from '@/lib/api';
import {
  comprimirFoto,
  contarFotosLocales,
  esFotoLocal,
  guardarFotoLocal,
  idFotoLocal,
  resolverFotos,
  subirFotoLocal,
} from '@/lib/fotos';
import { encolar, sincronizar } from '../cola';
import { db } from '../db';

const FIRMA = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  cloudName: 'demo',
  apiKey: 'clave-publica',
  timestamp: 1763300000,
  signature: 'firma-abc',
  folder: 'mercaimpulso/2026-11-16/maria',
};
const resp = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
let n = 0;
/** Simula la API (firma) y Cloudinary (subida). */
function servidorFeliz() {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).endsWith('/fotos/firma')) return resp(FIRMA);
    if (String(url) === FIRMA.uploadUrl) {
      n++;
      return resp({ public_id: `mercaimpulso/foto${n}`, secure_url: `https://res.cloudinary.com/demo/foto${n}.jpg` });
    }
    if (String(url).endsWith('/registros/sync')) return resp({ resultados: [{ id: 'r1', ok: true }] });
    throw new Error(`URL inesperada ${url}`);
  });
}

beforeEach(async () => {
  await Promise.all([db.cola.clear(), db.borradores.clear(), db.fotosPendientes.clear()]);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  n = 0;
});
afterEach(() => vi.unstubAllGlobals());

const archivo = () => new File(['x'.repeat(5000)], 'IMG_0001.jpg', { type: 'image/jpeg' });

describe('fotos', () => {
  it('comprime a máx. 1280 px, JPEG ~0,72 y ≤ ~400 KB', async () => {
    await comprimirFoto(archivo());
    expect(imageCompression).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ maxWidthOrHeight: 1280, initialQuality: 0.72, maxSizeMB: 0.4, fileType: 'image/jpeg' }),
    );
  });

  it('guarda la foto en el celular y devuelve una referencia local', async () => {
    const f = await guardarFotoLocal(archivo(), 'novedad', 'u1');
    expect(esFotoLocal(f)).toBe(true);
    const reg = await db.fotosPendientes.get(idFotoLocal(f));
    expect(reg).toMatchObject({ usuarioId: 'u1', contexto: 'novedad', tipo: 'image/jpeg', subida: null });
    expect(reg!.datos.byteLength).toBeGreaterThan(0);
  });

  it('pide firma y sube a Cloudinary con FormData (file, api_key, timestamp, signature, folder)', async () => {
    servidorFeliz();
    const local = await guardarFotoLocal(archivo(), 'gondola', 'u1');
    const subida = await subirFotoLocal(idFotoLocal(local));

    expect(subida).toEqual({ publicId: 'mercaimpulso/foto1', url: 'https://res.cloudinary.com/demo/foto1.jpg' });
    const [urlFirma, initFirma] = fetchMock.mock.calls[0];
    expect(String(urlFirma)).toMatch(/\/api\/v1\/fotos\/firma$/);
    expect(JSON.parse(initFirma.body)).toEqual({ contexto: 'gondola' });

    const [urlSubida, initSubida] = fetchMock.mock.calls[1];
    expect(urlSubida).toBe(FIRMA.uploadUrl);
    const fd = initSubida.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('api_key')).toBe('clave-publica');
    expect(fd.get('timestamp')).toBe(String(FIRMA.timestamp));
    expect(fd.get('signature')).toBe('firma-abc');
    expect(fd.get('folder')).toBe(FIRMA.folder);
    expect(fd.get('file')).toBeTruthy();

    // queda en caché: no se vuelve a subir
    expect(await subirFotoLocal(idFotoLocal(local))).toEqual(subida);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sin señal: lanza ErrorRed y la foto sigue en el celular', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const local = await guardarFotoLocal(archivo(), 'novedad', 'u1');
    await expect(subirFotoLocal(idFotoLocal(local))).rejects.toBeInstanceOf(ErrorRed);
    expect((await db.fotosPendientes.get(idFotoLocal(local)))?.subida).toBeNull();
  });

  it('resolverFotos reemplaza las referencias locales (góndola y novedades de lotes)', async () => {
    servidorFeliz();
    const g = await guardarFotoLocal(archivo(), 'gondola', 'u1');
    const nv = await guardarFotoLocal(archivo(), 'novedad', 'u1');
    const r = {
      items: {
        '33017': {
          agot: false,
          lotesIni: [{ id: 'a', cantidad: 1, vto: '2026-11-20', novedad: { tipo: 'Vacío perdido', nota: '', fotos: [nv] } }],
        },
      },
      fotosGondola: [g, { publicId: 'ya/subida', url: 'https://res.cloudinary.com/demo/x.jpg' }],
    };
    expect(contarFotosLocales(r)).toBe(2);
    const { registro, idsLocales } = await resolverFotos(r);
    expect(idsLocales).toHaveLength(2);
    expect(contarFotosLocales(registro)).toBe(0);
    expect(registro.fotosGondola[1].publicId).toBe('ya/subida');
    expect(registro.items['33017'].lotesIni![0].novedad!.fotos[0].url).toMatch(/^https:\/\/res\.cloudinary\.com/);
    // lotesFin no existía y no debe aparecer
    expect('lotesFin' in registro.items['33017']).toBe(false);
  });

  it('al sincronizar sube las fotos pendientes antes de enviar el registro', async () => {
    servidorFeliz();
    const g = await guardarFotoLocal(archivo(), 'gondola', 'u1');
    const reg: RegistroInput = {
      fecha: '2026-11-16',
      turno: 'Tarde',
      tipoDia: 'Laboral',
      pdvId: 'p1',
      items: { '33017': { agot: false, lotesIni: [] } },
      ejec: {},
      comp: {},
      impulso: {},
      nov: [],
      obs: '',
      fotosGondola: [g],
      geo: { lat: 4.4, lng: -75.2, precisionM: 5, capturadoEn: '2026-11-16T18:00:00.000Z' },
    };
    await encolar('r1', 'u1', reg, { pdvNombre: 'P1', nProductos: 1, peorNivel: 'ok', fueraDeRango: null });
    const res = await sincronizar('u1');
    expect(res.enviados).toBe(1);
    const sync = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/registros/sync'))!;
    const enviado = JSON.parse(sync[1].body).registros[0];
    expect(enviado.fotosGondola).toEqual([{ publicId: 'mercaimpulso/foto1', url: 'https://res.cloudinary.com/demo/foto1.jpg' }]);
    expect(await db.fotosPendientes.count()).toBe(0);
    expect(await db.cola.count()).toBe(0);
  });
});
