import os
import io
import tempfile
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from PIL import Image
from werkzeug.utils import secure_filename

app = Flask(__name__, template_folder='templates')
CORS(app)  # add Access-Control-Allow-Origin: * to all routes

# Config
OCR_API_URL = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
CROP_BOX    = (700, 530, 1000, 870)         # (left, top, right, bottom)
MAX_SIZE    = 16 * 1024 * 1024              # 16 MB
UPLOAD_DIR  = tempfile.gettempdir()
ALLOWED_EXTS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

app.config['MAX_CONTENT_LENGTH'] = MAX_SIZE
app.config['UPLOAD_FOLDER']    = UPLOAD_DIR

def allowed_file(filename):
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTS
    )

def extract_table(ocr_data):
    lines = defaultdict(list)
    runner_count = 1

    for item in ocr_data:
        y_center = sum(pt[1] for pt in item["boxes"]) / 4
        y_key = round(y_center / 10) * 10
        lines[y_key].append(item)

    rows = []
    for y in sorted(lines):
        line = sorted(lines[y], key=lambda x: x["boxes"][0][0])
        nickname = exp = time = None

        for item in line:
            txt = item["txt"].strip()
            lower = txt.lower()
            if lower in {"nickname","exp","time","tr","rank","points","score","bonus","levelupt",""}:
                continue
            if lower == "time over":
                time = "TIME OVER"
            elif ":" in txt and len(txt.split(":")) == 3:
                time = txt
            elif txt.isdigit() and len(txt) > 5:
                exp = int(txt)
            elif " " in txt:
                for part in txt.split():
                    if part.isdigit() and len(part) > 5:
                        exp = int(part)
            elif txt.isprintable() and not txt.isdigit() and len(txt) <= 10:
                nickname = txt

        if not nickname and exp and time:
            nickname = f"runner{runner_count}"
            runner_count += 1

        if nickname and exp and time:
            rows.append({"nickname":nickname,"exp":exp,"time":time})

    return rows

class PlayerDataAggregator:
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, filename, players_data):
        self.processed_images.append({
            'filename': filename,
            'players': players_data,
            'player_count': len(players_data)
        })
        for p in players_data:
            nick, exp, t = p['nickname'], p['exp'], p['time']
            if nick in self.players:
                entry = self.players[nick]
                entry['totalEXP']    += exp
                entry['appearances'] += 1
                entry['images'].append(filename)
                if t != 'TIME OVER':
                    if entry['bestTime']=='TIME OVER' or t < entry['bestTime']:
                        entry['bestTime'] = t
                else:
                    entry['timeOverCount'] += 1
            else:
                self.players[nick] = {
                    'nickname': nick,
                    'totalEXP': exp,
                    'appearances': 1,
                    'bestTime': t,
                    'timeOverCount': 1 if t=='TIME OVER' else 0,
                    'images': [filename]
                }

    def get_aggregated_data(self):
        players_list = list(self.players.values())
        total_exp = sum(p['totalEXP'] for p in players_list)
        return {
            'players': players_list,
            'statistics': {
                'unique_players': len(players_list),
                'total_images':   len(self.processed_images),
                'total_exp':      total_exp,
                'avg_exp':        (total_exp // len(players_list)) if players_list else 0
            },
            'processed_images': self.processed_images
        }

@app.route('/')
def index():
    # renders templates/index.html
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process_images():
    if 'images' not in request.files:
        return jsonify({'error':'No images provided'}), 400

    files = request.files.getlist('images')
    if not files or all(f.filename=='' for f in files):
        return jsonify({'error':'No images selected'}), 400

    agg = PlayerDataAggregator()
    proc = []
    for idx, file in enumerate(files):
        if file and allowed_file(file.filename):
            fname = secure_filename(file.filename)
            path  = os.path.join(UPLOAD_DIR, f"temp_{idx}_{fname}")
            file.save(path)
            try:
                ocr_json    = requests.post(
                    OCR_API_URL,
                    headers={'accept':'application/json'},
                    files={'file':('img.jpg', open(path,'rb'),'image/jpeg')}
                ).json()
                data        = extract_table(ocr_json)
                agg.add_image_data(fname, data)
                proc.append({'filename':fname,'players':data,'player_count':len(data)})
            except Exception as e:
                proc.append({'filename':fname,'error':str(e),'players':[],'player_count':0})
            finally:
                os.remove(path)

    result = agg.get_aggregated_data()
    return jsonify({
        'success': True,
        'processed_images':    proc,
        'aggregated_players':  result['players'],
        'statistics':          result['statistics'],
        'total_images':        len(proc),
        'unique_players':      result['statistics']['unique_players']
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status':'healthy'})

if __name__ == '__main__':
    # for local testing
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
