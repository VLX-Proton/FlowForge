import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Import global stylesheet (dark theme, blur, etc.)
import './style.css'

import App from './App.vue'

const app = createApp(App)

app.use(createPinia())

app.mount('#app')