/// <reference types="vite/client" />
import '../../preload/index.d';
import AnsiiToHtml from 'ansi-to-html';
import React, { useState, useEffect, useRef } from 'react'

import BaseStyle from './components/base';
import AppBar from './components/appBar';

import {
  Box, Button, InputLabel, MenuItem, FormControl, styled, Paper,
  Select, SelectChangeEvent, TextField, Switch, Stack, Checkbox,
  FormGroup, FormControlLabel, FormLabel, Radio, RadioGroup
} from "@mui/material"

const Item = styled( Paper )(({ theme }) => ({
  //backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function App() {
  
  const [ mediaSourceId, setMediaSourceId ] = useState( 10 );
  const [ isDownloadOnly, setIsDownloadOnly ] = useState( false );
  const [ mediaSourcePath, setMediaSourcePath ] = useState( '' );
  const [ savePath, setSavePath ] = useState('');
  const [ sourceLang, setSourceLang ] = useState<'auto' | 'en' | 'ja'>('auto');
  const [ isTranslate, setIsTranslate ] = useState( false );

  const logsElement = useRef<HTMLDivElement | null>( null );
  const savePathRef = useRef<string | null>(null);
  const isTranslateRef = useRef<boolean | null>( null );

  const convert = new AnsiiToHtml({ newline: true });
  savePathRef.current = savePath;
  isTranslateRef.current = isTranslate;
  let ignore = false;

  useEffect(() => {
    async function startFetching() {
      if (!ignore) {
        window.electron.ipcRenderer.on('script-logs', (_, logString) => {
          let convertText = convert.toHtml( logString ).replace(/(<br\/>){4,}/g, '');
          if ( convertText.match(/\[script-end\]/) ) {
            convertText += `<br/>`;
          }
          if ( convertText.match( /\[DeepL\]/ ) && isTranslateRef.current ) {
            window.electron.ipcRenderer.send('create-run-player-file', savePathRef.current );
            startDeeplTranslate();
          }
          logsElement.current!.insertAdjacentHTML('beforeend', convertText);
          logsElement.current!.scrollTop = logsElement.current!.scrollHeight;
        });

        window.addEventListener('keydown', (e) => {
          if ( e.ctrlKey && e.shiftKey && e.code === 'KeyA' ) {
            window.electron.ipcRenderer.send('self-run-player', savePathRef.current );
          }
        });
      }
    }
    startFetching();
    return () => { ignore = true };
  }, []);

  const handleMediaSource = ( e: SelectChangeEvent ) => {
    setMediaSourceId( Number( e.target.value ) );
  }

  const getSavePath = async () => {
    const savePath = await window.electron.ipcRenderer.invoke('save-path');
    if ( savePath ) setSavePath( savePath );
  }

  const getLoadLocalfilePath = async () => {
    const filepath = await window.electron.ipcRenderer.invoke('load-localfile-path');
    if ( filepath ) setMediaSourcePath( filepath );
  }

  const openDeeplClient = () => {
    window.electron.ipcRenderer.send('open-deepl-client');
  }

  const sendFormData = () => {
    window.electron.ipcRenderer.send('translate-start', {
      mediaSourceId, isDownloadOnly, mediaSourcePath, savePath,
      sourceLang, isTranslate
    });
  }

  const startDeeplTranslate = async () => {
    const result = await window.electron.ipcRenderer.invoke('deepl-translate', savePathRef.current );
  }

  return (
    <BaseStyle>
      <AppBar />
      <Box component="form" sx={{ padding: '10px', width: '100%' }}>
        <FormControl variant="standard" sx={{ marginRight: '10px', width: '120px' }}>
          <InputLabel id="media-source-select-label">メディアソース</InputLabel>
          <Select
            labelId="media-source-select-label"
            id="media-source-select"
            value={ `${ mediaSourceId }` }
            label="メディアソース"
            sx={{ padding: '2px 10px' }}
            onChange={ handleMediaSource }
          >
            <MenuItem value={10}>YouTube</MenuItem>
            <MenuItem value={20}>X Space</MenuItem>
            <MenuItem value={30}>ローカル</MenuItem>
          </Select>
        </FormControl>
        <TextField
          id="media-url-or-path" type="text"
          variant="standard" label={
            mediaSourceId === 10 && "動画のURL" ||
            mediaSourceId === 20 && "スペースアーカイブのURL" ||
            mediaSourceId === 30 && "ローカルからメディアファイルを読み込む"
          }
          placeholder={
            mediaSourceId === 10 && "例：https://www.youtube.com/watch?v=EEed8S9ECe4" ||
            mediaSourceId === 20 && "例：https://twitter.com/i/spaces/1YpKkgzQwPBKj?s=20" ||
            mediaSourceId === 30 && "例：C:\\Users\\tarou\\Downloads\\audio.m4a" || ""
          }
          sx={{
            width: mediaSourceId === 30 && "calc( 100% - 230px )" || "calc( 100% - 130px )",
            marginRight: mediaSourceId === 30 && '10px' || '0'
          }}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{ style: {
            padding: '4px 10px', marginTop: '4px',
          } }}
          value={ mediaSourcePath }
          onChange={(e) => { setMediaSourcePath( e.target.value ) }}
        />
        {
          mediaSourceId === 30 &&
          <Button
            variant="outlined"
            color="primary"
            sx={{ width: '90px', marginTop: '16px' }}
            onClick={ getLoadLocalfilePath }
          >
              参照
          </Button>
        }
        <TextField
          id="output-path" type="text"
          variant="standard" label="保存先のパス"
          placeholder="例：C:\Users\tarou\Downloads"
          sx={{ width: 'calc( 100% - 100px )', marginTop: '10px', marginRight: '10px' }}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{ style: {
            padding: '4px 10px', marginTop: '4px',
          } }}
          value={ savePath }
          onChange={(e) => { setSavePath( e.target.value ) }}
        />
        <Button
          variant="outlined"
          sx={{ width: '90px', marginTop: '25px' }}
          color="secondary"
          onClick={ getSavePath }
        >
            参照
        </Button>
      </Box>
      <FormControl component="fieldset" sx={{ padding: '10px', marginTop: '10px' }}>
        <FormLabel
          component="legend"
          sx={{ opacity: 1, width: 'auto', height: 'auto' }}
        >
          処理するメディアの言語
        </FormLabel>
        <RadioGroup
          row aria-labelledby="demo-row-radio-buttons-group-label"
          name="row-radio-buttons-group"
          value={ sourceLang }
          onChange={(e) => setSourceLang( e.target.value as any )}
        >
          <FormControlLabel disabled={ isDownloadOnly } value="auto" control={<Radio />} label="自動検出" />
          <FormControlLabel disabled={ isDownloadOnly } value="en" control={<Radio />} label="英語" />
          <FormControlLabel disabled={ isDownloadOnly } value="ja" control={<Radio />} label="日本語" />
        </RadioGroup>
      </FormControl>
      <FormControl component="fieldset" sx={{ padding: '10px', marginTop: '10px' }}>
        <FormLabel
          component="legend"
          sx={{ opacity: 1, width: 'auto', height: 'auto' }}
        >
          字幕の翻訳を有効化
        </FormLabel>
        <FormGroup aria-label="position" row>
          <FormControlLabel
            value="start"
            control={<Switch onChange={(_, checked) => { setIsTranslate( checked ) }} disabled={ isDownloadOnly } color="primary" />}
            label="英語から日本語への翻訳"
            labelPlacement="start"
          />
        </FormGroup>
      </FormControl>
      <FormControl component="fieldset" sx={{ padding: '10px', marginTop: '10px' }}>
        <FormLabel
          component="legend"
          sx={{ opacity: 1, width: 'auto', height: 'auto' }}
        >
          各種認証／ログイン
        </FormLabel>
        <Stack spacing={2} direction="row">
          <Button
            variant="contained"
            color="secondary"
            onClick={ startDeeplTranslate }
          >X（旧Twitter）</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={ openDeeplClient }
          >
            DeepL
          </Button>
        </Stack>
      </FormControl>
      <Box sx={{ width: '100%', padding: '10px' }}>
        <label style={{ padding: '10px' }} htmlFor="log-erea">ログ出力</label>
        <FormControlLabel
          sx={{ float: 'right' }}
          control={<Checkbox />} 
          label="ダウンロードのみ"
          disabled={ mediaSourceId === 30 ? true : false }
          checked={ isDownloadOnly }
          onChange={(_, checked) => { setIsDownloadOnly( checked ) }}
        />
        <Item
          id='logs-xterm'
          sx={{
            width: '100%', height: '200px', //position: 'relative',
            overflow: 'scroll', textAlign: 'unset'
          }}
          ref={ logsElement }
          //dangerouslySetInnerHTML={{ __html: scriptLogs }}
        ></Item>
      </Box>
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2} direction="row" sx={{ padding: '0 10px' }}>
          <Item sx={{ width: '75%' }}>....</Item>
          <Item sx={{ width: '25%' }}>
          <Stack spacing={2} direction="row" useFlexGap alignItems={ 'center' }>
            <Button variant="outlined">クリア</Button>
            <Button
              sx={{ flexGrow: 1 }}
              variant="contained"
              onClick={ sendFormData }
            >
              処理開始
            </Button>
          </Stack>
          </Item>
        </Stack>
      </Box>
    </BaseStyle>
  )
}
