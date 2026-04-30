import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import VueOnsen from 'vue-onsenui'
import 'onsenui/css/onsenui.css'
import 'onsenui/css/onsen-css-components.css'

createApp(App).use(VueOnsen).mount('#app')
