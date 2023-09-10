/// <reference types="vite/client" />
import '../../preload/index.d';
import React, { useState, useEffect, useRef } from 'react'

import BaseStyle from './components/base';
import AppBar from './components/appBar';

import {
  Box, styled, Paper
} from "@mui/material"

const Item = styled( Paper )(({ theme }) => ({
  //backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

export default function Player() {

  const videoElement = useRef<HTMLVideoElement | null>( null );
  const subtitle = useRef<{
    start: number, end: number, text: string,
    translated_texts: {[key: string]: string}
  }[] | null>( null );
  const [ currentSubtitle, setCurrentSubtitle ] = useState('');
  const [ title, setTitle ] = useState('');

  let ignore = false;
  useEffect(() => {
    async function startFetching() {
      if ( !ignore ) {
        window.electron.ipcRenderer.once('media-stream', (_, media) => {
          const video = new Blob([ media.buffer ], { type: media.mime });
          videoElement.current!.src = window.URL.createObjectURL( video );
          setTitle( media.title );
        });
        window.electron.ipcRenderer.once('subtitle-json', (_, json) => {
          subtitle.current = json; console.log( json );
          subtitle.current?.reverse();
        });
      }
    }
    startFetching();
    return () => { ignore = true };
  }, []);

  const viewSubtitleControl = () => {

    for ( const sub of subtitle.current! ) {
      if ( sub.start <= videoElement.current!.currentTime ) {
        setCurrentSubtitle( sub.translated_texts.ja ); break;
      }
    }
  }

  return (
    <BaseStyle>
      <AppBar useType={'player'} />
      <Box
        sx={{
          display: 'flex', width: '100%',
          height: 'calc( 100vh - 25.6px )', alignItems: 'stretch',
          backgroundColor: 'transparent'
        }}
      >
        <Box
          sx={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'stretch', backgroundColor: 'transparent',
            width: '100%', height: '100%'
          }}
        >
          <Item sx={{ width: '100%', backgroundColor: 'transparent' }}>
            <h1 style={{ padding: '5px', fontSize: '15pt' }}>{ title }</h1>
            <video 
              controls
              style={{ width: '100%', aspectRatio: '16 / 9' }}
              ref={ videoElement }
              onTimeUpdate={ viewSubtitleControl }
            ></video>
          </Item>
          <Box sx={{ display: 'flex', flexBasis: '100%', flex: 1 }}>
            <Item sx={{ fontSize: '15pt', flex: 1, textAlign: 'center' }} aria-live="assertive">
              { currentSubtitle }
            </Item>
          </Box>
        </Box>
      </Box>
    </BaseStyle>
  )
}