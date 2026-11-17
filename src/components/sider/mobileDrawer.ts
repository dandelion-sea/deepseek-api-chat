/** 移动端抽屉动效：抽屉从左侧推入，主页面同步右移并淡出；横向滑动跟手开合 */

export type DrawerElements = {
  drawer: HTMLElement
  /** 盖在抽屉上的暗色层，随打开逐渐消失 */
  scrim: HTMLElement
  page: HTMLElement
  /** 盖在主页面上的淡出层，点击关闭抽屉 */
  veil: HTMLElement
}

const DURATION = 280
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const VEIL_OPACITY = 0.7
/** 判定手势方向前允许的移动距离 */
const SLOP = 8
/** 松手时超过这个速度（px/ms）按甩动方向开合，否则按位置过半判断 */
const FLING_VELOCITY = 0.3

/** 开合过程中写入的内联样式 */
const INLINE_PROPERTIES = ['transition', 'transform', 'opacity', 'visibility', 'pointer-events']

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/** 起点到主页面之间有可向左回滚的横向滚动区域（代码块、表格）时，右滑留给它滚动 */
const canScrollBack = (target: Element, boundary: HTMLElement) => {
  for (
    let element: Element | null = target;
    element && element !== boundary;
    element = element.parentElement
  ) {
    if (
      element.scrollLeft > 0 &&
      element.scrollWidth > element.clientWidth &&
      /auto|scroll/.test(getComputedStyle(element).overflowX)
    ) {
      return true
    }
  }
  return false
}

export const bindMobileDrawer = (
  elements: DrawerElements,
  { isOpen, setOpen }: { isOpen: () => boolean; setOpen: (open: boolean) => void }
) => {
  const { drawer, scrim, page, veil } = elements
  let settleTimer = 0

  /** 关闭到位后去掉内联样式，回到 CSS 的隐藏状态，主页面也不再保留 transform */
  const reset = () => {
    for (const element of [drawer, scrim, page, veil]) {
      for (const property of INLINE_PROPERTIES) {
        element.style.removeProperty(property)
      }
    }
  }

  /** progress：0 为关闭，1 为完全打开 */
  const render = (progress: number, animate: boolean) => {
    window.clearTimeout(settleTimer)
    const width = drawer.offsetWidth
    const transition = animate
      ? `transform ${DURATION}ms ${EASING}, opacity ${DURATION}ms ${EASING}`
      : 'none'
    for (const element of [drawer, scrim, page, veil]) {
      element.style.transition = transition
    }
    drawer.style.visibility = 'visible'
    veil.style.visibility = 'visible'
    drawer.style.transform = `translate3d(${(progress - 1) * width}px, 0, 0)`
    page.style.transform = `translate3d(${progress * width}px, 0, 0)`
    veil.style.transform = page.style.transform
    scrim.style.opacity = String(1 - progress)
    veil.style.opacity = String(progress * VEIL_OPACITY)
    veil.style.pointerEvents = progress === 1 ? 'auto' : 'none'
    if (progress === 0) {
      settleTimer = window.setTimeout(reset, animate ? DURATION : 0)
    }
  }

  let gesture: {
    startX: number
    startY: number
    target: Element
    open: boolean
    dragging: boolean
    progress: number
    lastX: number
    lastTime: number
    velocity: number
  } | null = null

  const settle = (open: boolean) => {
    render(open ? 1 : 0, true)
    if (open !== isOpen()) {
      setOpen(open)
    }
  }

  const onTouchStart = (event: TouchEvent) => {
    gesture = null
    const target = event.target
    if (
      event.touches.length !== 1 ||
      !(target instanceof Element) ||
      !(page.contains(target) || drawer.contains(target) || veil.contains(target))
    ) {
      return
    }
    const touch = event.touches[0]
    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      target,
      open: isOpen(),
      dragging: false,
      progress: 0,
      lastX: touch.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    }
  }

  const onTouchMove = (event: TouchEvent) => {
    if (!gesture) {
      return
    }
    if (event.touches.length !== 1) {
      if (gesture.dragging) {
        settle(gesture.open)
      }
      gesture = null
      return
    }
    const touch = event.touches[0]
    const dx = touch.clientX - gesture.startX
    const dy = touch.clientY - gesture.startY
    if (!gesture.dragging) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) {
        return
      }
      // 纵向滑动、朝已到位的方向滑动、或右滑横向滚动区域时，不接管手势
      if (
        Math.abs(dy) >= Math.abs(dx) ||
        dx > 0 === gesture.open ||
        (!gesture.open && canScrollBack(gesture.target, page))
      ) {
        gesture = null
        return
      }
      gesture.dragging = true
      // 打开抽屉前收起键盘
      if (!gesture.open && document.activeElement instanceof HTMLElement) {
        if (page.contains(document.activeElement)) {
          document.activeElement.blur()
        }
      }
    }
    if (event.cancelable) {
      event.preventDefault()
    }
    gesture.progress = clamp((gesture.open ? 1 : 0) + dx / drawer.offsetWidth)
    render(gesture.progress, false)
    const elapsed = event.timeStamp - gesture.lastTime
    if (elapsed > 0) {
      gesture.velocity = 0.8 * ((touch.clientX - gesture.lastX) / elapsed) + 0.2 * gesture.velocity
    }
    gesture.lastX = touch.clientX
    gesture.lastTime = event.timeStamp
  }

  const onTouchEnd = () => {
    if (gesture?.dragging) {
      const { velocity, progress } = gesture
      settle(Math.abs(velocity) > FLING_VELOCITY ? velocity > 0 : progress > 0.5)
    }
    gesture = null
  }

  const onResize = () => {
    if (isOpen()) {
      render(1, false)
    }
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
  document.addEventListener('touchcancel', onTouchEnd)
  window.addEventListener('resize', onResize)

  return {
    render,
    destroy: () => {
      window.clearTimeout(settleTimer)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('resize', onResize)
      reset()
    },
  }
}
