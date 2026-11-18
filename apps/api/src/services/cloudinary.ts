import cloudinaryPkg from 'cloudinary';
import { env } from '../config/env.js';

const cloudinary = cloudinaryPkg.v2;

export const cloudinaryConfigurado = () =>
  !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/** Firma para subida directa desde el navegador (solo `timestamp` y `folder` van firmados). */
export function firmarSubida(folder: string, ahora = new Date()) {
  const timestamp = Math.floor(ahora.getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET!);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    signature,
    folder,
  };
}
