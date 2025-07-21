import os
import json
import tempfile
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
import requests
import re
from collections import defaultdict
from werkzeug.utils import secure_filename

app = Flask(__name__, template_folder='templates')

# 1) Enable CORS on every single response
@app.after_request
def add_cors(resp):
    resp.headers['Access-Control-Allow-Origin']  = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    return resp

# Config
OCR_API_URL  = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
MAX_SIZE     = 16 * 1024 * 1024              # 16 MB
UPLOAD_DIR   = tempfile.gettempdir()
ALLOWED_EXTS = {'png','jpg','jpeg','gif','bmp','webp'}

app.config['MAX_CONTENT_LENGTH'] = MAX_SIZE
app.config['UPLOAD_FOLDER']     = UPLOAD_DIR

def allowed_file(fname):
    return '.' in fname and fname.rsplit('.',1)[1].lower() in ALLOWED_EXTS

def extract_table(ocr_data):
    lines = defaultdict(list)
    runner_count = 1

    # bucket OCR boxes by their vertical position
    for item in ocr_data:
        y_center = sum(pt[1] for pt in item["boxes"]) / 4
        y_key    = round(y_center / 10) * 10
        lines[y_key].append(item)

    rows = []
    for y in sorted(lines):
        line = sorted(lines[y], key=lambda x: x["boxes"][0][0])
        nickname = tr = exp = time = None

        for item in line:
            txt = item["txt"].strip()
            lw  = txt.lower()

            # skip headers or empty
            if lw in {"rank","nickname","time","tr","exp","points","score","bonus","levelupt",""}:
                continue

            # time detection
            if lw == "time over":
                time = "TIME OVER"
            elif ":" in txt and len(txt.split(":")) == 3:
                time = txt

            # numeric detection — grab all digit‑runs
            nums = re.findall(r"\d+", txt)
            if len(nums) == 2:
                # two numbers in one cell → first is TR, second is EXP
                tr  = int(nums[0])
                exp = int(nums[1])
            elif len(nums) == 1:
                # one number only — decide by length
                n = nums[0]
                if len(n) <= 5:
                    tr = int(n)  # small number → TR
                else:
                    exp = int(n)  # big number → EXP

            # anything else shorter, treat as nickname
            if txt.isprintable() and not txt.isdigit() and len(txt) <= 10 and not nickname:
                nickname = txt

        # fallback runner name
        if not nickname and exp and time:
            nickname = f"runner{runner_count}"
            runner_count += 1

        # only append fully populated rows
        if nickname and exp is not None and time is not None:
            rows.append({
                "nickname": nickname,
                "tr":        tr,
                "exp":       exp,
                "time":      time
            })

    return rows
class PlayerDataAggregator:
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, fname, pdata):
        self.processed_images.append({
            'filename': fname,
            'players': pdata,
            'player_count': len(pdata)
        })
        for p in pdata:
            nick, ex, t = p['nickname'], p['exp'], p['time']
            if nick in self.players:
                e = self.players[nick]
                e['totalEXP']    += ex
                e['appearances'] += 1
                e['images'].append(fname)
                if t!='TIME OVER':
                    if e['bestTime']=='TIME OVER' or t<e['bestTime']:
                        e['bestTime']=t
                else:
                    e['timeOverCount'] += 1
            else:
                self.players[nick] = {
                    'nickname': nick,
                    'totalEXP': ex,
                    'appearances': 1,
                    'bestTime': t,
                    'timeOverCount': 1 if t=='TIME OVER' else 0,
                    'images': [fname]
                }

    def get_aggregated_data(self):
        lst = list(self.players.values())
        tot = sum(p['totalEXP'] for p in lst)
        return {
            'players': lst,
            'statistics': {
                'unique_players': len(lst),
                'total_images':   len(self.processed_images),
                'total_exp':      tot,
                'avg_exp':        (tot//len(lst)) if lst else 0
            },
            'processed_images': self.processed_images
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST','OPTIONS'])
def process_images():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if 'images' not in request.files:
        return jsonify({'error':'No images provided'}), 400

    files = request.files.getlist('images')
    if not files or all(f.filename=='' for f in files):
        return jsonify({'error':'No images selected'}), 400

    agg, resp = PlayerDataAggregator(), []
    for i, file in enumerate(files):
        fname = secure_filename(file.filename)
        path  = os.path.join(UPLOAD_DIR, f"temp_{i}_{fname}")
        file.save(path)
        try:
            # Send raw file to OCR
            with open(path,'rb') as f:
                ocr = requests.post(
                    OCR_API_URL,
                    headers={'accept':'application/json'},
                    files={'file': (fname, f, 'image/jpeg')}
                ).json()

            # DEBUG log
            print(f"\nOCR for {fname}:", json.dumps(ocr, indent=2))

            players = extract_table(ocr)
            print(f"Parsed {len(players)} rows for {fname}")

            agg.add_image_data(fname, players)
            resp.append({'filename':fname,'players':players,'player_count':len(players)})

        except Exception as e:
            print(f"Error on {fname}:", e)
            resp.append({'filename':fname,'error':str(e),'players':[],'player_count':0})
        finally:
            os.remove(path)

    out = agg.get_aggregated_data()
    return jsonify({
        'success': True,
        'processed_images': resp,
        'aggregated_players': out['players'],
        'statistics': out['statistics'],
        'total_images': len(resp),
        'unique_players': out['statistics']['unique_players']
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status':'healthy'})

if __name__=='__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
