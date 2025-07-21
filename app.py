# app.py

import os
import json
import tempfile
from collections import defaultdict
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from werkzeug.utils import secure_filename

app = Flask(__name__, template_folder="templates")
CORS(app)

OCR_API_URL  = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
MAX_SIZE     = 16 * 1024 * 1024
UPLOAD_DIR   = tempfile.gettempdir()
ALLOWED_EXTS = {"png","jpg","jpeg","gif","bmp","webp"}

app.config["MAX_CONTENT_LENGTH"] = MAX_SIZE
app.config["UPLOAD_FOLDER"]     = UPLOAD_DIR

def allowed_file(fname):
    return "." in fname and fname.rsplit(".",1)[1].lower() in ALLOWED_EXTS

def extract_table(ocr_data):
    lines = defaultdict(list)
    runner_count = 1
    for item in ocr_data:
        y_center = sum(pt[1] for pt in item["boxes"]) / 4
        y_key    = round(y_center/10)*10
        lines[y_key].append(item)

    rows = []
    for y in sorted(lines):
        line = sorted(lines[y], key=lambda x: x["boxes"][0][0])
        nickname = exp = time = None

        for it in line:
            txt = it["txt"].strip()
            lw  = txt.lower()

            if lw in {"rank","nickname","time","tr","exp","points","score","bonus","levelupt",""}:
                continue

            if lw == "time over":
                time = "TIME OVER"
                continue
            if ":" in txt and len(txt.split(":"))==3:
                time = txt
                continue

            if txt.isdigit() and len(txt)>5:
                exp = int(txt)
                continue
            if " " in txt:
                for part in txt.split():
                    if part.isdigit() and len(part)>5:
                        exp = int(part)
                        break
                if exp is not None:
                    continue

            if txt.isprintable() and not txt.isdigit() and len(txt)<=10:
                nickname = txt

        if not nickname and exp is not None and time is not None:
            nickname = f"runner{runner_count}"
            runner_count += 1

        if nickname and exp is not None and time:
            rows.append({"nickname":nickname,"exp":exp,"time":time})

    return rows

class PlayerDataAggregator:
    def __init__(self):
        self.players = {}
        self.processed_images = []

    def add_image_data(self, filename, players_data):
        self.processed_images.append({
            "filename": filename,
            "players":  players_data,
            "player_count": len(players_data)
        })
        for p in players_data:
            nick, ex, t = p["nickname"], p["exp"], p["time"]
            if nick in self.players:
                e = self.players[nick]
                e["totalEXP"]    += ex
                e["appearances"] += 1
                e["images"].append(filename)
                if t!="TIME OVER":
                    if e["bestTime"]=="TIME OVER" or t<e["bestTime"]:
                        e["bestTime"]=t
                else:
                    e["timeOverCount"]+=1
            else:
                self.players[nick]={
                    "nickname":      nick,
                    "totalEXP":      ex,
                    "appearances":   1,
                    "bestTime":      t,
                    "timeOverCount": 1 if t=="TIME OVER" else 0,
                    "images":        [filename]
                }

    def get_aggregated_data(self):
        lst   = list(self.players.values())
        total = sum(p["totalEXP"] for p in lst)
        return {
            "players": lst,
            "statistics":{
                "unique_players":len(lst),
                "total_images":  len(self.processed_images),
                "total_exp":     total,
                "avg_exp":       (total//len(lst)) if lst else 0
            },
            "processed_images": self.processed_images
        }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process", methods=["POST","OPTIONS"])
def process_images():
    if request.method=="OPTIONS":
        return jsonify({}),200

    if "images" not in request.files:
        return jsonify({"error":"No images provided"}),400

    files = request.files.getlist("images")
    if not files or all(f.filename=="" for f in files):
        return jsonify({"error":"No images selected"}),400

    agg,results=PlayerDataAggregator(),[]
    for i,file in enumerate(files):
        fname=secure_filename(file.filename)
        path=os.path.join(UPLOAD_DIR,f"temp_{i}_{fname}")
        file.save(path)
        try:
            with open(path,"rb") as f:
                resp=requests.post(
                    OCR_API_URL,
                    headers={"accept":"application/json"},
                    files={"file":(fname,f,"application/octet-stream")}
                )
            if resp.status_code!=200:
                raise RuntimeError(f"OCR error {resp.status_code}")
            ocr_data=resp.json()
            players=extract_table(ocr_data)
            agg.add_image_data(fname,players)
            results.append({
                "filename":fname,
                "players":players,
                "player_count":len(players)
            })
        except Exception as e:
            print(f"Error {fname}: {e}")
            results.append({
                "filename":fname,
                "error":str(e),
                "players":[],
                "player_count":0
            })
        finally:
            os.remove(path)

    out=agg.get_aggregated_data()
    return jsonify({
        "success":True,
        "processed_images":results,
        "aggregated_players":out["players"],
        "statistics":out["statistics"],
        "total_images":len(results),
        "unique_players":out["statistics"]["unique_players"]
    })

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status":"healthy"})

if __name__=="__main__":
    port=int(os.environ.get("PORT",5000))
    app.run(debug=True,host="0.0.0.0",port=port)
