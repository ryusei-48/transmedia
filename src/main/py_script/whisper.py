import sys, glob, json, re

print("########## Start of character arrival [script-start] ##########")

try:
    from torch import cuda
    from faster_whisper import WhisperModel
except ImportError:
    sys.stderr.write("「faster_whisper」か「pytorch」モジュールが見つかりません。\n")
    sys.exit(1)
    
mediaSourcePath = sys.argv[1]
mediaFilePath = glob.glob( f"{ mediaSourcePath }\\*" )[0]
model_size = "large-v2"
transcribe_results = []
plasticated_result = []

model = WhisperModel(
    model_size, compute_type="float16",
    device= 'cuda' if cuda.is_available() else 'cpu'
)
segments, info = model.transcribe(
    mediaFilePath, beam_size=5, word_timestamps=True,
    initial_prompt="こんにちは、私は山田です。Hello, I am Yamada."
)

print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

for segment in segments:
    transcribe_tmp = { "start": segment.start, "end": segment.end, "subtitle": segment.text, "word_timestamps": [] }
    for word in segment.words:
        transcribe_tmp["word_timestamps"].append({ "start": word[0], "end": word[1], "text": word[2] })
    transcribe_results.append( transcribe_tmp )
    print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))

with open( f"{ mediaSourcePath }\\transcribe.json", "w", encoding="utf-8" ) as json_file:
    json.dump( transcribe_results, json_file, indent=2, ensure_ascii=False )
    
if len( glob.glob( f"{ mediaSourcePath }\\transcribe.json" ) ) > 0:
    word_tmp, word_start_tmp, skip_flag = "", 0, False
    for transcribe in transcribe_results:
        for word in transcribe["word_timestamps"]:
            word_tmp += word["text"]
            if not skip_flag:
                word_start_tmp = word["start"]
                skip_flag = True
            if re.search( r"(\.|。)$", word["text"] ):
                plasticated_result.append({
                    "start": word_start_tmp,
                    "end": word["end"], "text": re.sub( r"^\s+", "", word_tmp )
                })
                skip_flag = False
                word_tmp = ""
                
with open( f"{ mediaSourcePath }\\plasticated.json", "w", encoding="utf-8" ) as json_file:
    json.dump( plasticated_result, json_file, indent=2, ensure_ascii=False )

print("########## End of character arrival [script-end][DeepL] ##########")