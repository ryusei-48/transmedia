"use strict";
const electron = require("electron");
const path = require("path");
const pty = require("node-pty");
const fs = require("fs");
const icon = path.join(__dirname, "./chunks/icon-4363016c.png");
const youtube_dl_py = path.join(__dirname, "./chunks/youtube-dl-36b994ca.py");
const whisper_py = path.join(__dirname, "./chunks/whisper-1d26b05c.py");
if (!electron.app.requestSingleInstanceLock())
  electron.app.exit(0);
const transmedia = {
  Windows: { players: [] },
  //storage: {}, 
  windowClosable: false,
  isPtySendable: false,
  //config: new Store<storeConfig>({ encryptionKey: 'ymzkrk33' }),
  run: function() {
    electron.app.whenReady().then(async () => {
      transmedia.Windows.main = this.createWindowInstance();
      transmedia.Windows.deepl = await this.deeplTranslateFrame();
      transmedia.ptyProcess = pty.spawn(`powershell.exe`, [], {
        name: "xterm-color",
        cols: 200,
        rows: 60,
        cwd: process.env.HOME,
        env: process.env
      });
      transmedia.ptyProcess.onData((stream) => {
        if (stream.match(/\[script-start\]/g)) {
          transmedia.isPtySendable = true;
        }
        if (transmedia.isPtySendable) {
          transmedia.Windows.main?.webContents.send("script-logs", stream);
        }
        if (stream.match(/\[script-end\]/g)) {
          transmedia.isPtySendable = false;
        }
      });
      if (process.argv.length >= 3) {
        transmedia.Windows.players.push(await transmedia.createPlayer());
      }
      electron.app.on("activate", () => {
        if (electron.BrowserWindow.getAllWindows().length === 0)
          transmedia.createWindowInstance();
      });
    });
    electron.app.on("second-instance", (e, argv) => {
      e.preventDefault();
      console.log(argv);
    });
    electron.ipcMain.on("window-close", () => {
      this.windowClosable = true;
      electron.app.quit();
    });
    electron.app.on("before-quit", async () => {
      console.log("Attempting to quit app");
    });
    electron.ipcMain.on("window-maximize", () => {
      if (this.Windows.main?.isMaximized()) {
        this.Windows.main?.unmaximize();
      } else
        this.Windows.main?.maximize();
    });
    electron.ipcMain.on("window-minize", () => {
      this.Windows.main?.minimize();
    });
    electron.ipcMain.on("open-deepl-client", () => {
      if (!transmedia.Windows.deepl.visible) {
        transmedia.Windows.deepl?.show();
      } else
        transmedia.Windows.deepl?.focus();
    });
    electron.ipcMain.on("translate-start", async (_, formData) => {
      if (formData.mediaSourceId === 10) {
        transmedia.ptyProcess?.write(
          [
            "python",
            youtube_dl_py,
            formData.mediaSourcePath,
            formData.savePath + ";",
            "python",
            whisper_py,
            formData.savePath
          ].join(" ") + "\r"
        );
      } else if (formData.mediaSourceId === 30) {
        transmedia.ptyProcess?.write(
          [
            "python",
            whisper_py,
            formData.savePath
          ].join(" ") + "\r"
        );
      }
    });
    electron.ipcMain.handle("deepl-translate", async (_, sourcePath) => {
      const jsonPath = sourcePath + `\\plasticated.json`;
      const plasticated = JSON.parse(
        fs.readFileSync(jsonPath, { encoding: "utf-8" })
      );
      const translated = [];
      for (const subtitle of plasticated) {
        await transmedia.Windows.deepl?.webContents.executeJavaScript(
          `window.location.href = "https://www.deepl.com/ja/translator#en/ja/${subtitle.text}"`,
          true
        );
        for (let i = 0; i < 15; i++) {
          const translateText = await transmedia.Windows.deepl?.webContents.executeJavaScript(
            `[...translateElem][1].textContent;`,
            true
          );
          if (translateText !== "") {
            translated.push({ ...subtitle, translated_texts: { ja: translateText } });
            break;
          } else
            await sleep(1e3);
        }
      }
      await new Promise((resolve2) => {
        fs.writeFile(
          `${sourcePath}\\translated.json`,
          JSON.stringify(translated, void 0, 2),
          { encoding: "utf-8" },
          (err) => {
            resolve2();
          }
        );
      });
      return true;
    });
    electron.ipcMain.handle("save-path", async () => {
      const result = await electron.dialog.showOpenDialog(transmedia.Windows.main, {
        properties: ["openDirectory"],
        title: "保存先のパスを選択してください。",
        defaultPath: electron.app.getPath("home")
      });
      if (!result.canceled) {
        return result.filePaths[0];
      } else
        return null;
    });
    electron.ipcMain.on("create-run-player-file", (_, savePath) => {
      fs.writeFile(savePath + `/run-player.tsap`, JSON.stringify({
        resource_path: savePath
      }, void 0, 2), { encoding: "utf-8" }, (err) => {
        if (err)
          throw err;
      });
    });
    electron.ipcMain.handle("load-localfile-path", async () => {
      const result = await electron.dialog.showOpenDialog(transmedia.Windows.main, {
        properties: ["openFile"],
        title: "読み込むメディアファイルを選択してください。",
        defaultPath: electron.app.getPath("home"),
        filters: [{ name: "media", extensions: ["mp3", "m4a", "wav", "mp4"] }]
      });
      if (!result.canceled) {
        return result.filePaths[0];
      } else
        return null;
    });
    electron.ipcMain.on("self-run-player", async (_, savePath) => {
      transmedia.Windows.players.push(await transmedia.createPlayer());
    });
    electron.app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        electron.app.quit();
      }
    });
  },
  createWindowInstance: function() {
    const window = new electron.BrowserWindow({
      width: 900,
      height: 600,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      ...process.platform === "linux" ? { icon } : {},
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        sandbox: false,
        webviewTag: true
      }
    });
    window.on("ready-to-show", () => {
      window.show();
    });
    window.webContents.setWindowOpenHandler((details) => {
      electron.shell.openExternal(details.url);
      return { action: "deny" };
    });
    if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
      window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      window.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
    return window;
  },
  createPlayer: async function() {
    const player = new electron.BrowserWindow({
      width: 900,
      height: 600,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      ...process.platform === "linux" ? { icon } : {},
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        sandbox: false,
        webviewTag: true
      }
    });
    player.on("ready-to-show", () => {
      player.show();
    });
    if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
      await player.loadURL(process.env["ELECTRON_RENDERER_URL"] + `/player.html`);
    } else {
      await player.loadFile(path.join(__dirname, "../renderer/player.html"));
    }
    return player;
  },
  deeplTranslateFrame: async function() {
    const deeplWindow = new electron.BrowserWindow({
      width: 1e3,
      height: 700,
      show: false,
      frame: true,
      autoHideMenuBar: true,
      backgroundColor: "#0f0f0f",
      //...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        sandbox: false,
        webviewTag: true
      }
    });
    deeplWindow.on("close", (e) => {
      if (!this.windowClosable) {
        e.preventDefault();
        deeplWindow.hide();
      }
    });
    deeplWindow.loadURL("https://www.deepl.com/ja/translator");
    deeplWindow.webContents.on("did-finish-load", async () => {
      let scriptText = `
      const translateElem = document.body.querySelectorAll("div.lmt__inner_textarea_container > d-textarea > div");
      `;
      deeplWindow.webContents.executeJavaScript(scriptText, true);
    });
    return deeplWindow;
  }
};
function sleep(sec) {
  return new Promise((resolve2) => {
    setTimeout(() => {
      resolve2();
    }, sec);
  });
}
transmedia.run();
