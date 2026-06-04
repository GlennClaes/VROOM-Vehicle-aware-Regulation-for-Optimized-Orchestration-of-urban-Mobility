import { createApp } from 'vue'
import App from './App.vue'
import { init } from './initialization'

    ;(async () => {
    try {
        const initResources = await init()

        const loadingEl = document.getElementById('loading')
        if (loadingEl) loadingEl.remove()

        const app = createApp(App, { initResources })

        // KRITIEK: Wacht een fractie zodat de browser de div #canvas-wrapper
        // een echte breedte en hoogte kan geven.
        window.requestAnimationFrame(() => {
            app.mount('#app')
        })

    } catch (e) {
        const h = document.createElement('h1')
        h.innerText = '500 Server Error — check the console'
        document.body.appendChild(h)
        console.error(e)
    }
})()
