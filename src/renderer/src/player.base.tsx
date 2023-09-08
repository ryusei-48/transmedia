/// <reference types="vite/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import Player from './player';
import '../assets/main.scss'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
      <Player />
  </React.StrictMode>,
)