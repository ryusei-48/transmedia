/// <reference types="vite/client" />
import '../../../preload/index.d';
import React from 'react'
import { AppBar, Toolbar, Typography, IconButton } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close";
import MaximizeIcon from "@mui/icons-material/HomeMax";
import MinimizeIcon from "@mui/icons-material/Minimize";

export default function appBar() {

  const windowClose = () => {
    window.electron.ipcRenderer.send('window-close')
  }

  const windowMaxmize = () => {
    window.electron.ipcRenderer.send('window-maximize');
  }

  const windowMiniMize = () => {
    window.electron.ipcRenderer.send('window-minize');
  }

  return (

    <AppBar position="static" sx={{ height: '25.6px' }}>
      <Toolbar sx={{ height: '25.6px', minHeight: 'unset' }} variant="dense" disableGutters>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Transmedia
        </Typography>
        <IconButton onClick={ windowMiniMize } aria-label='最小化' sx={{ '-webkit-app-region': 'no-drag', height: '100%' }}>
          <MinimizeIcon />
        </IconButton>
        <IconButton onClick={ windowMaxmize } aria-label='最大化' sx={{ '-webkit-app-region': 'no-drag', height: '100%' }}>
          <MaximizeIcon />
        </IconButton>
        <IconButton sx={{
          height: '100%',
          borderRadius: 'unset',
          '-webkit-app-region': 'no-drag',
          '&:hover': { backgroundColor: 'red' }
        }} aria-label='アプリ終了' onClick={ windowClose }>
          <CloseIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  )
}