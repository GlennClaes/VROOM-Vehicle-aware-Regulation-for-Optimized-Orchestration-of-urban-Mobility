// Ensure localStorage is available as a global in the jsdom test environment.
// jsdom provides localStorage on window, but some Vitest/jsdom versions
// don't expose it as a global. This setup file bridges the gap.

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = {}
  globalThis.localStorage = {
    getItem(key) {
      return key in store ? store[key] : null
    },
    setItem(key, value) {
      store[key] = String(value)
    },
    removeItem(key) {
      delete store[key]
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key])
    },
    get length() {
      return Object.keys(store).length
    },
    key(index) {
      return Object.keys(store)[index] || null
    },
  }
}
