export const KEY_CODES = {
    A: 'A'.charCodeAt(0),
    D: 'D'.charCodeAt(0),
    H: 'H'.charCodeAt(0),
    J: 'J'.charCodeAt(0),
    K: 'K'.charCodeAt(0),
    L: 'L'.charCodeAt(0),
    S: 'S'.charCodeAt(0),
    W: 'W'.charCodeAt(0),
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
}

const IGNORE_CSS_CLASSNAME = 'pnc-ignore'
const KEY_TIMEOUT_SECS = 0.5

function hasAncestor(className: string, element: HTMLElement | null): boolean {
    if (element === null) return false
    if (element.className === className) return true
    return hasAncestor(className, element.parentElement)
}

export const KEY_STATE: { [keyCode: number]: boolean } = {}
const KEY_TIMERS: { [keyCode: number]: ReturnType<typeof setTimeout> } = {}

window.addEventListener('keydown', (e) => {
    if (
        document.activeElement instanceof HTMLElement &&
        hasAncestor(IGNORE_CSS_CLASSNAME, document.activeElement)
    )
        return

    const { keyCode } = e
    KEY_STATE[keyCode] = true

    if (keyCode in KEY_TIMERS) clearTimeout(KEY_TIMERS[keyCode])
    KEY_TIMERS[keyCode] = setTimeout(() => {
        delete KEY_STATE[keyCode]
        delete KEY_TIMERS[keyCode]
    }, KEY_TIMEOUT_SECS * 1000)
})

window.addEventListener('keyup', (e) => {
    const { keyCode } = e
    if (keyCode in KEY_STATE) delete KEY_STATE[keyCode]
    if (keyCode in KEY_TIMERS) {
        clearTimeout(KEY_TIMERS[keyCode])
        delete KEY_TIMERS[keyCode]
    }
})

export function updateKeyStateWithEvent(event: KeyboardEvent) {
    if (KEY_STATE[KEY_CODES.CTRL] && !event.ctrlKey) delete KEY_STATE[KEY_CODES.CTRL]
    if (KEY_STATE[KEY_CODES.SHIFT] && !event.shiftKey) delete KEY_STATE[KEY_CODES.SHIFT]
    if (KEY_STATE[KEY_CODES.ALT] && !event.altKey) delete KEY_STATE[KEY_CODES.ALT]
}
