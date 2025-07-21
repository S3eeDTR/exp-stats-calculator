import os
import re
import json
import tempfile
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from werkzeug.utils import secure_filename

# ─── Flask & CORS Setup ────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates")
CORS(app)  # Allow all origins

@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"]  = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return resp

# ─── Configuration ─────────────────────────────────────────────────────────────
OCR_API_URL  = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
MAX_SIZE     = 16 * 1024 * 1024            # 16 MB
UPLOAD_DIR   = tempfile.gettempdir()
ALLOWED_EXTS = {"png","jpg","jpeg","gif","bmp","webp"}

app.config["MAX_CONTENT_LENGTH"] = MAX_SIZE
app.config["UPLOAD_FOLDER"]     = UPLOAD_DIR

def allowed_file(fname: str) -> bool:
    return "." in fname and fname.rsplit(".",1)[1].lower() in ALLOWED_EXTS

# ─── OCR Parsing & Table Extraction ────────────────────────────────────────────
def extract_table(ocr_data):
    """
    Parse OCR JSON into rows of {nickname, tr, exp, time}.
    If a single numeric run is longer than 10 digits, drop its first 5 digits.
    """
    lines = defaultdict(list)
    runner_count = 1

    # Group OCR items by approximate Y-coordinate bands
    for item in ocr_data:
        y_center = sum(pt[1] for pt in item["boxes"]) / 4
        y_key    = round(y_center / 10) * 10
        lines[y_key].append(item)

    rows = []
    for y in sorted(lines):
        line = sorted(lines[y], key=lambda x: x["boxes"][0][0])
        nickname = tr = exp = time = None

        for it in line:
            txt = it["txt"].strip()
            lw  = txt.lower()

            # Skip headers/empty
            if lw in {
                "rank","nickname","time","tr","exp",
                "points","score","bonus","levelupt",""
            }:
                continue

            # TIME detection
            if lw == "time over":
                time = "TIME OVER"
                continue
            if ":" in txt and len(txt.split(":")) == 3:
                time = txt
                continue

            # Extract digit sequences
            nums = re.findall(r"\d+", txt)
            if len(nums) == 2:
                # Two runs in one cell => TR + EXP
                tr  = int(nums[0])
                exp = int(nums[1])
                continue
            elif len(nums) == 1:
                n = nums[0]
                if len(n) > 10:
                    # Huge merged number: drop first 5 digits
                    n2  = n[5:]
                    exp = int(n2)
                else:
                    # Heuristic by length
                    if len(n) <= 5:
                        tr = int(n)
                    else:
                        exp = int(n)
                continue

            # Short text => nickname
            if txt.isprintable() and not txt.isdigit() and len(txt) <= 10:
                nickname = txt

        # Fallback runner name
        if not nickname and exp is not None and time is not None:
            nickname = f"runner{runner_count}"
            runner_count += 1

        # Only append fully populated rows
        if nickname and exp is not None and time:
            rows.append({
                "nickname": nickname,
                "tr":        tr,
                "exp":       exp,
                "time":      time
            })

    return rows

# ─── Aggregator ────────────────────────────────────────────────────────────────
class PlayerDataAggregator:
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, filename, players_data):
        self.processed_images.append({
            "filename":     filename,
            "players":      players_data,
            "player_count": len(players_data)
        })
        for p in players_data:
            nick, ex, t = p["nickname"], p["exp"], p["time"]
            if nick in self.players:
                e = self.players[nick]
                e["totalEXP"]    += ex
                e["appearances"] += 1
                e["images"].append(filename)
                # Update bestTime
                if t != "TIME OVER":
                    if e["bestTime"] == "TIME OVER" or t < e["bestTime"]:
                        e["bestTime"] = t
                else:
                    e["timeOverCount"] += 1
            else:
                self.players[nick] = {
                    "nickname":      nick,
                    "totalEXP":      ex,
                    "appearances":   1,
                    "bestTime":      t,
                    "timeOverCount": 1 if t == "TIME OVER" else 0,
                    "images":        [filename]
                }

    def get_aggregated_data(self):
        lst   = list(self.players.values())
        total = sum(p["totalEXP"] for p in lst)
        return {
            "players": lst,
            "statistics": {
                "unique_players": len(lst),
                "total_images":   len(self.processed_images),
                "total_exp":      total,
                "avg_exp":        (total // len(lst)) if lst else 0
            },
            "processed_images": self.processed_images
        }

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process", methods=["POST","OPTIONS"])
def process_images():
    # CORS preflight
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if "images" not in request.files:
        return jsonify({"error":"No images provided"}), 400

    files = request.files.getlist("images")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"error":"No images selected"}), 400

    agg, results = PlayerDataAggregator(), []
    for i, file in enumerate(files):
        fname = secure_filename(file.filename)
        path  = os.path.join(UPLOAD_DIR, f"temp_{i}_{fname}")
        file.save(path)

        try:
            # Send file directly to OCR (no cropping)
            with open(path,"rb") as f:
                ocr_resp = requests.post(
                    OCR_API_URL,
                    headers={"accept":"application/json"},
                    files={"file": (fname, f, "image/jpeg")}
                )
            print(f"OCR status for {fname}: {ocr_resp.status_code}")
            print("OCR response:", ocr_resp.text)

            if ocr_resp.status_code != 200:
                raise RuntimeError(f"OCR API error {ocr_resp.status_code}")

            ocr_data = ocr_resp.json()
            players  = extract_table(ocr_data)
            print(f"Parsed {len(players)} rows for {fname}")

            agg.add_image_data(fname, players)
            results.append({
                "filename":      fname,
                "players":       players,
                "player_count":  len(players)
            })
        except Exception as e:
            print(f"❌ Error on {fname}: {e}")
            results.append({
                "filename":      fname,
                "error":         str(e),
                "players":       [],
                "player_count":  0
            })
        finally:
            os.remove(path)

    out = agg.get_aggregated_data()
    return jsonify({
        "success":            True,
        "processed_images":   results,
        "aggregated_players": out["players"],
        "statistics":         out["statistics"],
        "total_images":       len(results),
        "unique_players":     out["statistics"]["unique_players"]
    })

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status":"healthy"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT",5000))
    app.run(debug=True, host="0.0.0.0", port=port)
