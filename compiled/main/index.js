"use strict";
const electron = require("electron");
const path = require("path");
const Store = require("electron-store");
const pty = require("node-pty");
const fs = require("fs");
const icon = path.join(__dirname, "./chunks/icon-7abc4b26.png");
if (!electron.app.requestSingleInstanceLock())
  electron.app.exit(0);
const APP_PATH = path.resolve(electron.app.getAppPath(), electron.app.isPackaged ? `..\\` : ".");
const youtube_dl_py = path.resolve(APP_PATH, ".\\extra\\youtube-dl.py");
const whisper_py = path.resolve(APP_PATH, ".\\extra\\whisper.py");
const transmedia = {
  Windows: { players: [] },
  windowClosable: false,
  isPtySendable: false,
  config: new Store({ encryptionKey: "idnfiI8DONSI1OS5Difj4di" }),
  run: function() {
    if (this.config.size === 0) {
      this.config.store = {
        sourceLang: "auto",
        isTranslate: true,
        whisperModel: "base",
        processInterval: 1e3
      };
    }
    electron.app.whenReady().then(async () => {
      transmedia.Windows.main = await this.createWindowInstance(false);
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
      if (process.argv.length >= 2) {
        const checkPath = process.argv.slice(-1)[0];
        if (await pathExist(checkPath) && path.isAbsolute(checkPath)) {
          transmedia.Windows.players.push(await transmedia.createPlayer(path.dirname(checkPath)));
        } else
          this.Windows.main?.show();
      } else
        this.Windows.main?.show();
    });
    electron.app.on("second-instance", async (e, argv) => {
      e.preventDefault();
      const checkPath = argv.slice(-1)[0];
      if (await pathExist(checkPath)) {
        this.Windows.players.push(await this.createPlayer(path.dirname(checkPath)));
      }
    });
    electron.ipcMain.on("config-update", (_, config) => {
      this.config.store = config;
    });
    electron.ipcMain.on("window-close", (_, pid) => {
      if (pid) {
        for (const [index, player] of this.Windows.players.entries()) {
          if (player.id === pid) {
            player.close();
            this.Windows.players.splice(index, 1);
            break;
          }
        }
        if (this.Windows.players.length === 0 && this.Windows.main?.isVisible())
          return;
      }
      if (this.Windows.players.length === 0) {
        this.windowClosable = true;
        electron.app.quit();
      } else if (!pid)
        this.Windows.main?.hide();
    });
    electron.ipcMain.on("window-maximize", (_, pid) => {
      if (pid) {
        for (const player of this.Windows.players) {
          if (player.id === pid) {
            if (player.isMaximized()) {
              player.unmaximize();
            } else
              player.maximize();
          }
        }
      } else {
        if (this.Windows.main?.isMaximized()) {
          this.Windows.main?.unmaximize();
        } else
          this.Windows.main?.maximize();
      }
    });
    electron.ipcMain.on("window-minize", (_, pid) => {
      if (pid) {
        for (const player of this.Windows.players) {
          if (player.id === pid) {
            player.minimize();
          }
        }
      } else
        this.Windows.main?.minimize();
    });
    electron.ipcMain.on("open-main-window", () => {
      if (this.Windows.main?.isVisible()) {
        this.Windows.main.focus();
      } else
        this.Windows.main?.show();
    });
    electron.ipcMain.on("open-deepl-client", () => {
      if (!transmedia.Windows.deepl.isVisible()) {
        transmedia.Windows.deepl?.show();
      } else
        transmedia.Windows.deepl?.focus();
    });
    electron.ipcMain.on("translate-start", async (_, formData) => {
      if (formData.mediaSourceId === 10) {
        transmedia.ptyProcess?.write(
          formData.isDownloadOnly ? [
            "python",
            youtube_dl_py,
            formData.mediaSourcePath,
            formData.savePath
          ].join(" ") + "\r" : [
            "python",
            youtube_dl_py,
            formData.mediaSourcePath,
            formData.savePath + ";",
            "python",
            whisper_py,
            formData.savePath,
            formData.whisperModel,
            formData.sourceLang
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
      const totalCount = plasticated.length - 1;
      for (const [index, subtitle] of plasticated.entries()) {
        this.Windows.main?.webContents.send(
          "translate-status",
          totalCount !== index ? `翻訳中...（${index} / ${totalCount}）` : ""
        );
        await transmedia.Windows.deepl?.webContents.executeJavaScript(
          `window.location.href = "https://www.deepl.com/ja/translator#en/ja/${subtitle.text}"`,
          true
        );
        for (let i = 0; i < 15; i++) {
          console.log("ループ");
          const translateText = await transmedia.Windows.deepl?.webContents.executeJavaScript(
            `[...translateElem][0].textContent;`,
            true
          );
          if (translateText !== "") {
            translated.push({ ...subtitle, translated_texts: { ja: translateText } });
            break;
          } else
            await sleep(this.config.store.processInterval);
        }
      }
      await new Promise((resolve2) => {
        fs.writeFile(
          `${sourcePath}\\translated.json`,
          JSON.stringify(translated, void 0, 2),
          { encoding: "utf-8" },
          (err) => {
            if (err)
              throw err;
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
        filters: [{ name: "media", extensions: ["mp3", "m4a", "wav", "mp4", "webm"] }]
      });
      if (!result.canceled) {
        return result.filePaths[0];
      } else
        return null;
    });
    electron.ipcMain.on("self-run-player", async (_, savePath) => {
      this.Windows.players.push(await this.createPlayer(savePath));
    });
    electron.app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        electron.app.quit();
      }
    });
  },
  createWindowInstance: async function(isShow = true) {
    const window = new electron.BrowserWindow({
      width: 812,
      height: 680,
      minWidth: 790,
      minHeight: 680,
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
    if (isShow) {
      window.on("ready-to-show", () => {
        window.show();
      });
    }
    window.webContents.setWindowOpenHandler((details) => {
      electron.shell.openExternal(details.url);
      return { action: "deny" };
    });
    window.webContents.on("did-finish-load", () => {
      window.webContents.send("config", { ...this.config.store });
    });
    if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
      await window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      await window.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
    return window;
  },
  createPlayer: async function(mediaPath) {
    const player = new electron.BrowserWindow({
      width: 900,
      height: 750,
      minWidth: 500,
      minHeight: 300,
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
    player.webContents.on("did-finish-load", () => {
      fs.readdir(mediaPath, (err, dirList) => {
        if (err)
          throw err;
        const mediaFile = dirList.filter((dir) => {
          return dir.match(/\.(mp4|webm)$/) ? true : false;
        });
        const extension = path.extname(mediaFile[0]);
        const title = path.basename(mediaFile[0], extension);
        fs.readFile(mediaPath + `\\` + mediaFile[0], (err2, buffer) => {
          if (err2)
            throw err2;
          if (extension === ".webm") {
            player.webContents.send("media-stream", { mime: "video/webm", buffer, title });
          } else
            player.webContents.send("media-stream", { mime: "video/mp4", buffer, title });
        });
      });
      fs.access(`${mediaPath}\\translated.json`, fs.constants.F_OK, (err) => {
        if (err)
          throw err;
        fs.readFile(`${mediaPath}\\translated.json`, { encoding: "utf-8" }, (err2, file) => {
          if (err2)
            throw err2;
          player.webContents.send("subtitle-json", JSON.parse(file));
        });
      });
    });
    if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
      await player.loadURL(process.env["ELECTRON_RENDERER_URL"] + `/player.html?pid=${player.id}`);
    } else {
      await player.loadURL(`file:\\\\${path.join(__dirname, `../renderer/player.html`)}?pid=${player.id}`);
    }
    return player;
  },
  deeplTranslateFrame: async function() {
    const deeplWindow = new electron.BrowserWindow({
      width: 1e3,
      height: 700,
      minWidth: 500,
      minHeight: 350,
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
      const translateElem = document.body.querySelectorAll("div[aria-labelledby='translation-target-heading']");
      `;
      deeplWindow.webContents.executeJavaScript(scriptText, true);
    });
    return deeplWindow;
  }
};
async function pathExist(path2) {
  return new Promise((resolve2) => {
    fs.access(path2, fs.constants.F_OK, (err) => {
      if (!err) {
        resolve2(true);
      } else
        resolve2(false);
    });
  });
}
function sleep(sec) {
  return new Promise((resolve2) => {
    setTimeout(() => {
      resolve2();
    }, sec);
  });
}
transmedia.run();
