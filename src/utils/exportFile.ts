export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const downloadText = (text: string, filename: string, type: string) =>
  downloadBlob(new Blob([text], { type }), filename)

export const canShareFile = (type = 'image/png') => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function' ||
    typeof navigator.share !== 'function'
  ) {
    return false
  }
  try {
    return navigator.canShare({ files: [new File([], 'share', { type })] })
  } catch {
    return false
  }
}

export const shareBlob = async (blob: Blob, filename: string) => {
  const file = new File([blob], filename, { type: blob.type })
  await navigator.share({ files: [file] })
}
