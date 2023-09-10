/// <reference types="vite/client" />
import '../../../preload/index.d';
import React from 'react'
import { AppBar, Toolbar, Typography, IconButton, Button } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close";
import MaximizeIcon from "@mui/icons-material/HomeMax";
import MinimizeIcon from "@mui/icons-material/Minimize";
import icon from '../../assets/icon.png';

export default function appBar( props: { useType?: 'player' } ) {

  const pid = Number(( new URLSearchParams( location.search ) ).get('pid') || -1 );

  const windowClose = () => {
    window.electron.ipcRenderer.send('window-close', props.useType === 'player' ? pid : null );
  }

  const windowMaxmize = () => {
    window.electron.ipcRenderer.send('window-maximize', props.useType === 'player' ? pid : null );
  }

  const windowMiniMize = () => {
    window.electron.ipcRenderer.send('window-minize', props.useType === 'player' ? pid : null );
  }

  const openMainWindow = () => {
    window.electron.ipcRenderer.send('open-main-window');
  }

  return (

    <AppBar position="static" sx={{ height: '25.6px' }}>
      <Toolbar sx={{ height: '25.6px', minHeight: 'unset' }} variant="dense" disableGutters>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, paddingLeft: '6px' }}>
          <img src={ icon } style={{ height: '1em', paddingRight: '5px', transform: 'translateY(2px)' }}></img>
          { props.useType === 'player' && 'Player - ' }Transmedia
        </Typography>
        {
          props.useType &&
          <Button
            variant="contained" onClick={ openMainWindow }
            sx={{ '-webkit-app-region': 'no-drag', height: '100%' }}
          >
            { 'ツールに移動' }
          </Button>
        }
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