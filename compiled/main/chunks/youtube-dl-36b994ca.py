import sys

print("########## Download videos from YouTube [script-start] ##########")

try:
  from yt_dlp import YoutubeDL
except ImportError:
    sys.stderr.write("「yt_dlp」モジュールが見つかりません。\n")
    sys.exit(1)

ydl = YoutubeDL({
  'outtmpl' : f"{sys.argv[2]}/%(title)s.%(ext)s",
  'format' : 'bestvideo+bestaudio/best'
})
result = ydl.download([ sys.argv[1] ])

print("########## End of download [script-end] ##########")