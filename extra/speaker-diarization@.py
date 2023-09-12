import sys, glob, json
from pyannote.audio import Pipeline

mediaSourcePath = sys.argv[1]
mediaFilePath = glob.glob( f"{ mediaSourcePath }/*.wav" )[0]

fp = open( f"{ mediaSourcePath }/plasticated.json", mode="r", encoding="utf-8" )
plasticated = json.load( fp )
fp.close()

pipeline = Pipeline.from_pretrained(
    'pyannote/speaker-diarization',
    use_auth_token="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"
)

DEMO_FILE = {'uri': 'blabal', 'audio': mediaFilePath}
dz = pipeline( DEMO_FILE )
    
dzJson = dz.for_json()
#dzList = list(reversed(dzJson["content"]))

diarizationFp = open( f"{ mediaSourcePath }/diarization.csv", mode="w", encoding="shift-jis" )
diarizationFp.write( "発話区間（秒）,話者,発話内容\n" )

for index, sentence in enumerate(plasticated):
    for dzc in dzJson["content"]:
        if sentence["start"] <= dzc["segment"]["start"]:
            plasticated[ index ]["speaker"] = dzc["label"]
            diarizationFp.write( f"{ round( sentence['start'], 2 ) }-{ round( sentence['end'], 2 ) },{ dzc['label'] }," + '"' + sentence['text'] + '"\n' )
            break

diarizationFp.close()

with open( f"{ mediaSourcePath }/plasticated.json", mode="w", encoding="utf-8" ) as fp:
    json.dump( plasticated, fp, indent=2, ensure_ascii=False )