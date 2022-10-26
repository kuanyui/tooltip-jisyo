import React from 'react'
import ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'

console.log('[LOG] options_ui/index.js!!!!')
const root = createRoot(document.getElementById('app')!)
root.render(<App />)