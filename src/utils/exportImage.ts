import { toBlob } from 'html-to-image'

const MAX_SIDE = 16_000

const waitForImages = async (node: HTMLElement) => {
  const images = [...node.querySelectorAll('img')]
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve()
            return
          }
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
    )
  )
}

export const exportNodeAsPng = async (
  node: HTMLElement,
  backgroundColor?: string,
  options: {
    width?: number
    height?: number
    style?: Partial<CSSStyleDeclaration>
  } = {}
): Promise<Blob> => {
  await document.fonts?.ready
  await waitForImages(node)
  const background = backgroundColor ?? getComputedStyle(node).backgroundColor
  const height = options.height ?? node.scrollHeight
  const pixelRatio = height * 2 <= MAX_SIDE ? 2 : 1
  const blob = await toBlob(node, {
    backgroundColor: background,
    pixelRatio,
    cacheBust: true,
    filter: (child) =>
      !(child instanceof HTMLElement && child.dataset.exportIgnore === 'true'),
    ...options,
  })
  if (!blob) {
    throw new Error('Failed to render image')
  }
  return blob
}

export const exportSvgAsPng = async (svg: SVGSVGElement, backgroundColor: string): Promise<Blob> => {
  const width = svg.viewBox.baseVal.width || svg.getBoundingClientRect().width
  const height = svg.viewBox.baseVal.height || svg.getBoundingClientRect().height
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.maxWidth = 'none'
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `position:absolute;left:0;top:0;z-index:-1;display:inline-block;padding:16px;background:${backgroundColor};`
  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)
  try {
    return await exportNodeAsPng(wrapper, backgroundColor)
  } finally {
    wrapper.remove()
  }
}
