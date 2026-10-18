/**
 * Клиентская оптимизация фото перед сохранением (как у SGX):
 * resize + JPEG compress → меньше вес, быстрее сайт.
 */
export async function optimizeImageFile(
  file: File,
  opts?: { maxSide?: number; quality?: number; mime?: string },
): Promise<{ dataUrl: string; bytes: number }> {
  const maxSide = opts?.maxSide ?? 1600
  const quality = opts?.quality ?? 0.82
  const mime = opts?.mime ?? 'image/jpeg'

  const bitmap = await createImageBitmap(file)
  try {
    let { width, height } = bitmap
    if (width > maxSide || height > maxSide) {
      if (width >= height) {
        height = Math.round((height / width) * maxSide)
        width = maxSide
      } else {
        width = Math.round((width / height) * maxSide)
        height = maxSide
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const dataUrl = canvas.toDataURL(mime, quality)
    // approximate bytes from base64
    const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
    return { dataUrl, bytes }
  } finally {
    bitmap.close()
  }
}

/** То же, но возвращает File для загрузки в PocketBase (file-поле) */
export async function optimizeImageToFile(
  file: File,
  opts?: { maxSide?: number; quality?: number },
): Promise<File> {
  const { dataUrl } = await optimizeImageFile(file, opts)
  const blob = await (await fetch(dataUrl)).blob()
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}
