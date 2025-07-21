import os
import re
import json
import tempfile
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from werkzeug.utils import secure_filename

# Initialize Flask app and enable CORS
app = Flask(__name__, template_folder='templates')
CORS(app)

# Configuration
OCR_API_URL  = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
MAX_SIZE     = 16 * 1024 * 1024        # 16 MB
UPLOAD_DIR   = tempfile.gettempdir()
ALLOWED_EXTS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

app.config['MAX_CONTENT_LENGTH'] = MAX_SIZE
app.config['UPLOAD_FOLDER']     = UPLOAD_DIR


def allowed_file(fname: str) -> bool:
    return '.' in fname and fname.rsplit('.', 1)[1].lower() in ALLOWED_EXTS


def extract_table(ocr_data):
    """
    Parse the OCR JSON to extract rows of (nickname, tr, exp, time).
    Splits any cell containing two digit-runs into TR and EXP.
    """
    lines = defaultdict(list)
    runner_count = 1

    # Group OCR items by approximate Y position
    for item in ocr_data:
        y_center = sum(pt[1] for pt in item['boxes']) / 4
        y_key    = round(y_center / 10) * 10
        lines[y_key].append(item)

    rows = []
    for y in sorted(lines):
        line = sorted(lines[y], key=lambda x: x['boxes'][0][0])
        nickname = tr = exp = time = None

        for it in line:
            txt = it['txt'].strip()
            lw  = txt.lower()

            # Skip headers and empty cells
            if lw in {
                'rank','nickname','time','tr','exp',
                'points','score','bonus','levelupt',''
            }:
                continue

            # TIME detection
            if lw == 'time over':
                time = 'TIME OVER'
                continue
            if ':' in txt and len(txt.split(':')) == 3:
                time = txt
                continue

            # Number parsing: grab all sequences of digits
            nums = re.findall(r'\d+', txt)
            if len(nums) == 2:
                # Two numbers in one cell → TR and EXP
                tr  = int(nums[0])
                exp = int(nums[1])
                continue
            elif len(nums) == 1:
                n = nums[0]
                # Heuristic: small number → TR, big → EXP
                if len(n) <= 5:
                    tr = int(n)
                else:
                    exp = int(n)
                continue

            # Short printable text → nickname
            if txt.isprintable() and not txt.isdigit() and len(txt) <= 10:
                nickname = txt

        # Fallback nickname if missing
        if not nickname and exp is not None and time is not None:
            nickname = f'runner{runner_count}'
            runner_count += 1

        # Only append fully populated rows
        if nickname and exp is not None and time:
            rows.append({
                'nickname': nickname,
                'tr':        tr,
                'exp':       exp,
                'time':      time
            })

    return rows


class PlayerDataAggregator:
    """
    Aggregates multiple runs: sums EXP, tracks appearances, best time, etc.
    """
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, filename, players_data):
        self.processed_images.append({
            'filename':     filename,
            'players':      players_data,
            'player_count': len(players_data)
        })
        for p in players_data:
            nick, ex, t = p['nickname'], p['exp'], p['time']
            if nick in self.players:
                e = self.players[nick]
                e['totalEXP']    += ex
                e['appearances'] += 1
                e['images'].append(filename)
                if t != 'TIME OVER':
                    if e['bestTime'] == 'TIME OVER' or t < e['bestTime']:
                        e['bestTime'] = t
                else:
                    e['timeOverCount'] += 1
            else:
                self.players[nick] = {
                    'nickname':      nick,
                    'totalEXP':      ex,
                    'appearances':   1,
                    'bestTime':      t,
                    'timeOverCount': 1 if t == 'TIME OVER' else 0,
                    'images':        [filename]
                }

    def get_aggregated_data(self):
        players_list = list(self.players.values())
        total_exp    = sum(p['totalEXP'] for p in players_list)
        return {
            'players': players_list,
            'statistics': {
                'unique_players': len(players_list),
                'total_images':   len(self.processed_images),
                'total_exp':      total_exp,
                'avg_exp':        (total_exp // len(players_list))
                                   if players_list else 0
            },
            'processed_images': self.processed_images
        }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/process', methods=['POST', 'OPTIONS'])
def process_images():
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if 'images' not in request.files:
        return jsonify({'error': 'No images provided'}), 400

    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No images selected'}), 400

    agg       = PlayerDataAggregator()
    resp_list = []

    for i, file in enumerate(files):
        filename = secure_filename(file.filename)
        path     = os.path.join(UPLOAD_DIR, f"temp_{i}_{filename}")
        file.save(path)

        try:
            # Send raw file to OCR API
            with open(path, 'rb') as f:
                ocr_resp = requests.post(
                    OCR_API_URL,
                    headers={'accept': 'application/json'},
                    files={'file': (filename, f, 'image/jpeg')}
                )
            # Debug logging
            print(f"OCR status for {filename}: {ocr_resp.status_code}")
            print("OCR raw response:", ocr_resp.text)

            if ocr_resp.status_code != 200:
                raise RuntimeError(f"OCR API error {ocr_resp.status_code}")

            ocr_data = ocr_resp.json()
            players  = extract_table(ocr_data)
            print(f"Parsed {len(players)} rows for {filename}")

            agg.add_image_data(filename, players)
            resp_list.append({
                'filename':     filename,
                'players':      players,
                'player_count': len(players)
            })

        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")
            resp_list.append({
                'filename':     filename,
                'error':        str(e),
                'players':      [],
                'player_count':  0
            })
        finally:
            os.remove(path)

    result = agg.get_aggregated_data()
    return jsonify({
        'success':            True,
        'processed_images':   resp_list,
        'aggregated_players': result['players'],
        'statistics':         result['statistics'],
        'total_images':       len(resp_list),
        'unique_players':     result['statistics']['unique_players']
    })


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
