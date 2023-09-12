import json, sys, re

mediaSourcePath = sys.argv[1]

fp = open( f"{ mediaSourcePath }\\plasticated.json", mode="r", encoding="utf-8" )
plasticatedJson = json.load( fp )
fp.close()
fp = open( f"{ mediaSourcePath }\\translate.plain.txt", mode="r", encoding="utf-8" )
translatedPlain = fp.read()
translatedPlain = translatedPlain.split("\n")
fp.close()

with open( f"{ mediaSourcePath }\\translated.json", mode="w", encoding="utf-8" ) as json_fp:
  translatedJson = []
  try:
    for index, plasticated in enumerate( plasticatedJson ):
      #print( str( index ) + ": " + plasticated["text"] )
      plasticated['translated_texts'] = {}
      plasticated['translated_texts']['ja'] = re.sub( "^[0-9]+:\s?", "", translatedPlain[ index ] )
      translatedJson.append( plasticated )
  except IndexError:
    print("")
  json.dump( translatedJson, json_fp, indent=2, ensure_ascii=False )
