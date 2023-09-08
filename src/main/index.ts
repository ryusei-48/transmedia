/// <reference types="electron-vite/node" />
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import pty from 'node-pty';
import fs from "fs";
import icon from '../../build/icon.png?asset'
import youtube_dl_py from './py_script/youtube-dl.py?asset'
import whisper_py from './py_script/whisper.py?asset';

if ( !app.requestSingleInstanceLock() ) app.exit(0);

//export type storeConfig = { instance?: { label: string, id: number, path: string }[] }

//const USER_DATA_PATH = app.getPath('userData');
//const STORAGE_PATH = USER_DATA_PATH + '/storage/database';

const transmedia: {

  Windows: { main?: BrowserWindow, deepl?: BrowserWindow, players: BrowserWindow[] },
  windowClosable: boolean, ptyProcess?: pty.IPty,
  isPtySendable: boolean,
  //storage: { [key: number]: { db?: Database.Database, stmt?: { [key: string]: Database.Statement } } },
  //config: Store<storeConfig>,
  run: () => void,
  createWindowInstance: () => BrowserWindow,
  createPlayer: () => Promise<BrowserWindow>,
  deeplTranslateFrame: () => Promise<BrowserWindow>

} = {

  Windows: { players: [] }, //storage: {}, 
  windowClosable: false, isPtySendable: false,
  //config: new Store<storeConfig>({ encryptionKey: 'ymzkrk33' }),

  run: function () {

    app.whenReady().then( async () => {

      transmedia.Windows.main = this.createWindowInstance();
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

      if ( process.argv.length >= 3 ) {
        transmedia.Windows.players.push( await transmedia.createPlayer() );
      }

      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) transmedia.createWindowInstance();
      });
    });

    app.on('second-instance', (e, argv) => {
      e.preventDefault();
      console.log( argv );
    });

    ipcMain.on('window-close', () => {
      this.windowClosable = true;
      app.quit();
      //app.exit(0);
    });

    app.on('before-quit', async () => {
      console.log('Attempting to quit app');
    });

    ipcMain.on('window-maximize', () => {
      if (this.Windows.main?.isMaximized()) {
        this.Windows.main?.unmaximize();
      } else this.Windows.main?.maximize();
    });

    ipcMain.on('window-minize', () => {
      this.Windows.main?.minimize();
    });

    ipcMain.on('open-deepl-client', () => {
      if ( !transmedia.Windows.deepl!.isVisible() ) {
        transmedia.Windows.deepl?.show();
      } else transmedia.Windows.deepl?.focus();
    });

    ipcMain.on('translate-start', async (_, formData) => {

      if ( formData.mediaSourceId === 10 ) {
        transmedia.ptyProcess?.write(
          [
            'python', youtube_dl_py, formData.mediaSourcePath, formData.savePath + ';',
            'python', whisper_py, formData.savePath
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

      for ( const subtitle of plasticated ) {
        await transmedia.Windows.deepl?.webContents.executeJavaScript(
          `window.location.href = "https://www.deepl.com/ja/translator#en/ja/${ subtitle.text }"`, true
        );

        for ( let i=0; i<15; i++ ) {
          const translateText = await transmedia.Windows.deepl?.webContents.executeJavaScript(
            `[...translateElem][1].textContent;`, true
          )

          if ( translateText !== "" ) {
            translated.push({ ...subtitle, translated_texts: { ja: translateText }})
            /*console.log( translateText );*/ break;
          } else await sleep( 1000 );
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
        filters: [{ name: 'media', extensions: [ 'mp3', 'm4a', 'wav', 'mp4' ] }]
      });

      if ( !result.canceled ) {
        return result.filePaths[0];
      } else return null;
    });

    ipcMain.on('self-run-player', async (_, /*savePath*/) => {
      transmedia.Windows.players.push( await transmedia.createPlayer() );
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

  createWindowInstance: function () {

    const window = new BrowserWindow({
      width: 900,
      height: 600,
      show: false, frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false, webviewTag: true
      }
    });

    window.on('ready-to-show', () => {
      window.show()
    })

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'));
    }

    return window;
  },

  createPlayer: async function () {
    
    const player = new BrowserWindow({
      width: 900,
      height: 600,
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

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
      await player.loadURL(process.env['ELECTRON_RENDERER_URL'] + `/player.html`)
    } else {
      await player.loadFile(join(__dirname, '../renderer/player.html'))
    }

    return player;
  },

  deeplTranslateFrame: async function () {

    const deeplWindow = new BrowserWindow({
      width: 1000,
      height: 700,
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
      const translateElem = document.body.querySelectorAll("div.lmt__inner_textarea_container > d-textarea > div");
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

function sleep( sec: number ) {

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, sec);
  });
}

transmedia.run();