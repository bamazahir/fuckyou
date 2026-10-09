import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './styles/index.css'
import './stores/theme' // applies the saved theme before first paint
import { App } from './App'

registerSW({ immediate: true })
// First-party install count (SPEC §12); the event only fires where the browser offers install.
window.addEventListener('appinstalled', () => {
  void import('./lib/supabase').then(({ supabase }) =>
    supabase.rpc('log_event', { p_name: 'pwa_installed', p_props: {} }),
  )
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
