import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

let root: ReactDOM.Root | null = null

function mount() {
  root = ReactDOM.createRoot(document.getElementById('root')!)
  root.render(<React.StrictMode><App /></React.StrictMode>)
}

function unmount() {
  root?.unmount()
  root = null
}

if ((window as any).__POWERED_BY_WUJIE__) {
  (window as any).__WUJIE_MOUNT = () => { mount() }
  ;(window as any).__WUJIE_UNMOUNT = () => { unmount() }
} else {
  mount()
}
