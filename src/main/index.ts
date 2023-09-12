/// <reference types="electron-vite/node" />
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, extname, basename, dirname, isAbsolute, resolve } from 'path'
import Store from 'electron-store';
import pty from 'node-pty';
import fs, { constants } from "fs";
import icon from '../../build/icon.png?asset'

if ( !app.requestSingleInstanceLock() ) app.exit(0);

const APP_PATH = resolve( app.getAppPath(), app.isPackaged ? `..\\` : '.' );
const youtube_dl_py = resolve( APP_PATH, '.\\extra\\youtube-dl.py' );
const whisper_py = resolve( APP_PATH, '.\\extra\\whisper.py' );

type AppConfig = {
  sourceLang: 'auto' | 'en' | 'ja', isTranslate: boolean,
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2',
  processInterval: number
}

const transmedia: {

  Windows: { main?: BrowserWindow, deepl?: BrowserWindow, players: BrowserWindow[] },
  windowClosable: boolean, ptyProcess?: pty.IPty,
  isPtySendable: boolean,
  config: Store<AppConfig>,
  run: () => void,
  createWindowInstance: ( isShow: boolean ) => Promise<BrowserWindow>,
  createPlayer: ( mediaPath: string ) => Promise<BrowserWindow>,
  deeplTranslateFrame: () => Promise<BrowserWindow>

} = {

  Windows: { players: [] },
  windowClosable: false, isPtySendable: false,
  config: new Store({ encryptionKey: 'idnfiI8DONSI1OS5Difj4di' }),

  run: function () {

    if ( this.config.size === 0 ) {
      this.config.store = {
        sourceLang: 'auto', isTranslate: true,
        whisperModel: 'base', processInterval: 1000
      }
    }

    app.whenReady().then( async () => {

      transmedia.Windows.main = await this.createWindowInstance( false );
      transmedia.Windows.deepl = await this.deeplTranslateFrame();

      transmedia.ptyProcess = pty.spawn( `powershell.exe`, [], {
        name: 'xterm-color',
        cols: 200, rows: 60,
        cwd: process.env.HOME,
        env: process.env
      });

      transmedia.ptyProcess.onData((stream) => {

        if ( stream.match(/\[script-start\]/g) ) {
          transmedia.isPtySendable = true;
        }

        if ( transmedia.isPtySendable ) {
          transmedia.Windows.main?.webContents.send( 'script-logs', stream ); 
        }

        if ( stream.match(/\[script-end\]/g) ) {
          transmedia.isPtySendable = false;
        }
      });

      if ( process.argv.length >= 2 ) {
        const checkPath = process.argv.slice(-1)[0];
        if ( await pathExist( checkPath ) && isAbsolute( checkPath ) ) {
          transmedia.Windows.players.push( await transmedia.createPlayer( dirname( checkPath ) ) );
        } else this.Windows.main?.show();
      } else this.Windows.main?.show();

      /*app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) transmedia.createWindowInstance();
      });*/
    });

    app.on('second-instance', async (e, argv) => {
      e.preventDefault();
      
      const checkPath = argv.slice(-1)[0];
      if ( await pathExist( checkPath ) ) {
        this.Windows.players.push( await this.createPlayer( dirname( checkPath ) ) )
      }
    });

    ipcMain.on('config-update', (_, config) => {
      /*this.config.set('sourceLang', config.sourceLang );
      this.config.set('isTranslate', config.isTranslate );
      this.config.set('whisperModel', config.whisperModel );
      this.config.set('processInterval', config.processInterval );*/
      this.config.store = config;
    });

    ipcMain.on('window-close', (_, pid) => {

      if ( pid ) {
        for ( const [ index, player ] of this.Windows.players.entries() ) {
          if ( player.id === pid ) {
            player.close();
            this.Windows.players.splice( index, 1 ); break;
          }
        }

        if ( this.Windows.players.length === 0 && this.Windows.main?.isVisible() ) return;
      }

      if ( this.Windows.players.length === 0 ) {
        this.windowClosable = true; app.quit();
      } else if ( !pid ) this.Windows.main?.hide();
    });

    ipcMain.on('window-maximize', (_, pid) => {

      if ( pid ) {
        for ( const player of this.Windows.players ) {
          if ( player.id === pid ) {
            if ( player.isMaximized() ) {
              player.unmaximize();
            } else player.maximize();
          }
        }
      } else {
        if (this.Windows.main?.isMaximized()) {
          this.Windows.main?.unmaximize();
        } else this.Windows.main?.maximize();
      }
    });

    ipcMain.on('window-minize', (_, pid) => {
      
      if ( pid ) {
        for ( const player of this.Windows.players ) {
          if ( player.id === pid ) {
            player.minimize();
          }
        }
      } else this.Windows.main?.minimize();
    });

    ipcMain.on('open-main-window', () => {
      if ( this.Windows.main?.isVisible() ) {
        this.Windows.main.focus();
      } else this.Windows.main?.show();
    });

    ipcMain.on('open-deepl-client', () => {
      if ( !transmedia.Windows.deepl!.isVisible() ) {
        transmedia.Windows.deepl?.show();
      } else transmedia.Windows.deepl?.focus();
    });

    ipcMain.on('translate-start', async (_, formData) => {

      if ( formData.mediaSourceId === 10 ) {
        transmedia.ptyProcess?.write(
          formData.isDownloadOnly ?
          [
            'python', youtube_dl_py, formData.mediaSourcePath, formData.savePath
          ].join(' ') + "\r"
          :
          [
            'python', youtube_dl_py, formData.mediaSourcePath, formData.savePath + ';',
            'python', whisper_py, formData.savePath, formData.whisperModel, formData.sourceLang
          ].join(' ') + "\r"
        );
      } else if ( formData.mediaSourceId === 30 ) {
        transmedia.ptyProcess?.write(
          [
            "python", whisper_py, formData.savePath
          ].join(' ') + "\r"
        );
      }
    });

    ipcMain.handle('deepl-translate', async (_, sourcePath) => {
      const jsonPath = sourcePath + `\\plasticated.json`;
      const plasticated: { start: number, end: number, text: string }[] = JSON.parse(
        fs.readFileSync( jsonPath, { encoding: 'utf-8' })
      );
      const translated: {
        start: number, end: number, text: string,
        translated_texts: { [ key: string ]: string }
      }[] = []
      const totalCount = plasticated.length - 1;

      for ( const [ index, subtitle ] of plasticated.entries() ) {
        
        this.Windows.main?.webContents.send(
          'translate-status',
          totalCount !== index ? `翻訳中...（${ index } / ${ totalCount }）` : ''
        );

        await transmedia.Windows.deepl?.webContents.executeJavaScript(
          `window.location.href = "https://www.deepl.com/ja/translator#en/ja/${ subtitle.text }"`, true
        );

        for ( let i=0; i<15; i++ ) {
          const translateText = await transmedia.Windows.deepl?.webContents.executeJavaScript(
            `[...translateElem][0].textContent;`, true
          )

          if ( translateText !== "" ) {
            translated.push({ ...subtitle, translated_texts: { ja: translateText }})
            /*console.log( translateText );*/ break;
          } else await sleep( this.config.store.processInterval );
        }
      }

      await new Promise<void>((resolve) => {
        fs.writeFile(
          `${ sourcePath }\\translated.json`, JSON.stringify( translated, undefined, 2 ),
          { encoding: 'utf-8' }, (err) => {
            if ( err ) throw err;
            resolve();
          }
        )
      });

      return true;
    });

    ipcMain.handle('save-path', async () => {
      const result = await dialog.showOpenDialog(transmedia.Windows.main!, {
        properties: ['openDirectory'],
        title: '保存先のパスを選択してください。',
        defaultPath: app.getPath('home')
      });

      if ( !result.canceled ) {
        return result.filePaths[0];
      } else return null;
    });

    ipcMain.on('create-run-player-file', (_, savePath) => {

      fs.writeFile( savePath + `/run-player.tsap`, JSON.stringify({
        resource_path: savePath
      }, undefined, 2 ), { encoding: 'utf-8' }, (err) => {
        if ( err ) throw err;
      });
    });

    ipcMain.handle('load-localfile-path', async () => {
      const result = await dialog.showOpenDialog(transmedia.Windows.main!, {
        properties: ['openFile'],
        title: '読み込むメディアファイルを選択してください。',
        defaultPath: app.getPath('home'),
        filters: [{ name: 'media', extensions: [ 'mp3', 'm4a', 'wav', 'mp4', 'webm' ] }]
      });

      if ( !result.canceled ) {
        return result.filePaths[0];
      } else return null;
    });

    ipcMain.on('self-run-player', async (_, savePath) => {
      this.Windows.players.push( await this.createPlayer( savePath ) );
    });

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    });
  },

  createWindowInstance: async function ( isShow = true ) {

    const window = new BrowserWindow({
      width: 812, height: 680,
      minWidth: 790, minHeight: 680,
      show: false, frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false, webviewTag: true
      }
    });

    if ( isShow ) {
      window.on('ready-to-show', () => {
        window.show()
      })
    }

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    window.webContents.on('did-finish-load', () => {
      window.webContents.send('config', { ...this.config.store });
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      await window.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      await window.loadFile(join(__dirname, '../renderer/index.html'));
    }

    return window;
  },

  createPlayer: async function ( mediaPath ) {
    
    const player = new BrowserWindow({
      width: 900, height: 750,
      minWidth: 500, minHeight: 300,
      show: false, frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false, webviewTag: true
      }
    });

    player.on('ready-to-show', () => {
      player.show()
    });

    player.webContents.on('did-finish-load', () => {
      fs.readdir( mediaPath, (err, dirList) => {
        if ( err ) throw err;
        const mediaFile = dirList.filter((dir) => {
          return dir.match(/\.(mp4|webm)$/) ? true : false;
        });
        const extension = extname( mediaFile[0] );
        const title = basename( mediaFile[0], extension );
        fs.readFile( mediaPath + `\\` + mediaFile[0], (err, buffer) => {
          if ( err ) throw err;
          if ( extension === '.webm' ) {
            player.webContents.send('media-stream', { mime: 'video/webm', buffer, title });
          } else player.webContents.send('media-stream', { mime: 'video/mp4', buffer, title });
        });
      });

      fs.access( `${ mediaPath }\\translated.json`, constants.F_OK, (err) => {
        if ( err ) throw err;
        fs.readFile( `${ mediaPath }\\translated.json`, { encoding: 'utf-8' }, (err, file) =>{
          if ( err ) throw err;
          player.webContents.send('subtitle-json', JSON.parse( file ));
        });
      });
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      await player.loadURL(process.env['ELECTRON_RENDERER_URL'] + `/player.html?pid=${ player.id }`)
    } else {
      await player.loadURL(`file:\\\\${ join(__dirname, `../renderer/player.html`) }` + `?pid=${ player.id }`)
    }

    return player;
  },

  deeplTranslateFrame: async function () {

    const deeplWindow = new BrowserWindow({
      width: 1000, height: 700,
      minWidth: 500, minHeight: 350,
      show: false, frame: true,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      //...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false, webviewTag: true
      }
    });

    deeplWindow.on('close', (e) => {
      if ( !this.windowClosable ) {
        e.preventDefault();
        deeplWindow.hide();
      }
    });

    deeplWindow.loadURL('https://www.deepl.com/ja/translator');

    deeplWindow.webContents.on('did-finish-load', async () => {

      let scriptText = `
      const translateElem = document.body.querySelectorAll("div[aria-labelledby='translation-target-heading']");
      `;
      deeplWindow.webContents.executeJavaScript( scriptText, true);
    });

    return deeplWindow;
  }
}
/*
function randomString(len: number = 10): string {

  let str: string = "0123456789abcdefghijklmnopqrstuvwxyz";
  let strLen: number = str.length;
  let result: string = '';

  for (let i = 0; i < len; i++) {
    result += str[Math.floor(Math.random() * strLen)];
  }

  return result;
}
*/

async function pathExist( path: string ) {

  return new Promise<boolean>((resolve) => {
    fs.access( path, constants.F_OK, (err) => {
      if ( !err ) {
        resolve( true );
      } else resolve( false );
    });
  });
}

function sleep( sec: number ) {

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, sec);
  })
}

transmedia.run();