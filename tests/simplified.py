"""Guard display dictionaries and HTML against traditional characters and Latin game abbreviations."""
import json, re
from pathlib import Path
from html.parser import HTMLParser
from opencc import OpenCC
root=Path(__file__).resolve().parents[1]
cc=OpenCC('t2s')
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,data):self.parts.append(data)
 def handle_starttag(self,tag,attrs):
  self.parts.extend(value for key,value in attrs if key in ['placeholder','aria-label','title','alt'] and value)
strings=[]
for group in json.loads((root/'data/zh-CN.json').read_text()).values():strings.extend(group.values())
for path in ['index.html','map.html','merchant.html']:
 parser=Text();parser.feed((root/path).read_text());strings.extend(parser.parts)
for item in json.loads((root/'data/merchants.json').read_text())['items'].values():
 strings.extend([item['name'],item['skill'],*item['effects']['normal'],*item['effects']['deep']])
for text in strings:
 assert cc.convert(text)==text, f'Traditional text: {text}'
 assert not re.search(r'[ＨＦＰＡ-Ｚａ-ｚ]|\b(?:HP|FP)\b|绝活',text),f'Unlocalized abbreviation: {text}'
print(f'{len(strings)} display strings passed simplified Chinese checks.')
