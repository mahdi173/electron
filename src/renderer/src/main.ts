
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './store'        // default export from store/index.ts
import vuetify from './plugins/vuetify'

createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .mount('#app')
