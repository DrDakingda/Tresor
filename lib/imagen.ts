// Reduce las fotos de tickets a ~1600px y JPEG para que ocupen 200–300 KB.
export async function comprimirImagen(archivo: File, maxLado = 1600, calidad = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir'))), 'image/jpeg', calidad)
  )
}
