from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
from collections import defaultdict
from PIL import Image
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

OCR_API_URL = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
CROP_BOX = (700, 530, 1000, 870)   # (left, top, right, bottom) for EXP table

def extract_table(ocr_data):
    lines = defaultdict(list)
    runner_count = 1  # for fallback nicknames

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
            txt_lower = txt.lower()

            if txt_lower in {"nickname", "exp", "time", "tr", "rank", "points", "score", "bonus", "levelupt", ""}:
                continue

            if txt_lower == "time over":
                time = "TIME OVER"

            elif ":" in txt and len(txt.split(":")) == 3:
                time = txt

            elif txt.isdigit() and len(txt) > 5:
                exp = int(txt)

            elif " " in txt:
                parts = txt.split()
                for part in parts:
                    if part.isdigit() and len(part) > 5:
                        exp = int(part)

            elif txt.isprintable() and len(txt) <= 10:
                if not txt.isdigit():
                    nickname = txt

        if not nickname and exp and time:
            nickname = f"runner{runner_count}"
            runner_count += 1

        if nickname and exp and time:
            rows.append({
                "nickname": nickname,
                "exp": exp,
                "time": time
            })

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

        for player in players_data:
            nickname = player['nickname']
            exp = player['exp']
            time = player['time']

            if nickname in self.players:
                self.players[nickname]['totalEXP'] += exp
                self.players[nickname]['appearances'] += 1
                self.players[nickname]['images'].append(filename)

                if time != 'TIME OVER' and self.players[nickname]['bestTime'] == 'TIME OVER':
                    self.players[nickname]['bestTime'] = time
                elif time != 'TIME OVER' and self.players[nickname]['bestTime'] != 'TIME OVER':
                    if time < self.players[nickname]['bestTime']:
                        self.players[nickname]['bestTime'] = time

                if time == 'TIME OVER':
                    self.players[nickname]['timeOverCount'] += 1
            else:
                self.players[nickname] = {
                    'nickname': nickname,
                    'totalEXP': exp,
                    'appearances': 1,
                    'bestTime': time,
                    'timeOverCount': 1 if time == 'TIME OVER' else 0,
                    'images': [filename]
                }

    def get_aggregated_data(self):
        players_list = list(self.players.values())
        total_exp = sum(player['totalEXP'] for player in players_list)
        return {
            'players': players_list,
            'statistics': {
                'unique_players': len(players_list),
                'total_images': len(self.processed_images),
                'total_exp': total_exp,
                'avg_exp': total_exp // len(players_list) if players_list else 0
            },
            'processed_images': self.processed_images
        }

@app.route("/process", methods=["POST"])
def process_images():
    try:
        if 'images' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files or all(file.filename == '' for file in files):
            return jsonify({'error': 'No images selected'}), 400
        
        aggregator = PlayerDataAggregator()
        
        for file in files:
            if file and file.filename:
                try:
                    # Crop the image before sending to OCR
                    image = Image.open(file.stream).convert("RGB")
                    cropped_image = image.crop(CROP_BOX)

                    img_byte_arr = io.BytesIO()
                    cropped_image.save(img_byte_arr, format='JPEG')
                    img_byte_arr.seek(0)

                    response = requests.post(
                        OCR_API_URL,
                        headers={'accept': 'application/json'},
                        files={'file': ('cropped_' + file.filename, img_byte_arr, 'image/jpeg')}
                    )

                    if response.status_code == 200:
                        ocr_data = response.json()
                        players_data = extract_table(ocr_data)
                        aggregator.add_image_data(file.filename, players_data)
                    else:
                        aggregator.processed_images.append({
                            'filename': file.filename,
                            'players': [],
                            'player_count': 0,
                            'error': f'OCR failed with status {response.status_code}'
                        })

                except Exception as e:
                    aggregator.processed_images.append({
                        'filename': file.filename,
                        'players': [],
                        'player_count': 0,
                        'error': str(e)
                    })

        result = aggregator.get_aggregated_data()

        return jsonify({
            'success': True,
            'processed_images': result['processed_images'],
            'aggregated_players': result['players'],
            'statistics': result['statistics']
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
