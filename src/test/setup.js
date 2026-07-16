import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.IntersectionObserver = TestIntersectionObserver

class TestResizeObserver {
  constructor(callback) { this.callback = callback }
  observe(target) { this.callback([{ target, contentRect: { width: 800, height: 320 } }]) }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
}
