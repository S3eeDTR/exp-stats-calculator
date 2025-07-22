import os
import io
import tempfile
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from PIL import Image
import requests
from werkzeug.utils import secure_filename

# ─── Configuration ─────────────────────────────────────────────────────────────
OCR_API_URL = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
MAX_SIZE    = 16 * 1024 * 1024  # 16 MB
UPLOAD_DIR  = tempfile.gettempdir()

app = Flask(__name__, template_folder="templates")
CORS(app, resources={r"/*": {"origins": "*"}})
app.config.update(
    MAX_CONTENT_LENGTH=MAX_SIZE,
    UPLOAD_FOLDER=UPLOAD_DIR
)

# ─── Pixel‐perfect boxes for nickname & EXP ────────────────────────────────────
ROW_BOXES = [
    {"nickname": (695, 575, 785, 600), "exp": (932, 581, 991, 601)},
    {"nickname": (695, 615, 785, 643), "exp": (932, 613, 991, 643)},
    {"nickname": (695, 650, 785, 680), "exp": (932, 652, 991, 680)},
    {"nickname": (695, 688, 785, 721), "exp": (932, 693, 991, 721)},
    {"nickname": (695, 729, 785, 760), "exp": (932, 735, 991, 760)},
    {"nickname": (695, 765, 785, 795), "exp": (932, 775, 991, 790)},
    {"nickname": (695, 805, 785, 835), "exp": (932, 810, 991, 830)},
    {"nickname": (695, 841, 785, 868), "exp": (932, 850, 991, 870)},
]

def safe_ocr_from_image(pil_img: Image.Image):
    """
    Send a PIL image to the OCR API, return its JSON or [] on any error.
    """
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG")
    buf.seek(0)
    try:
        resp = requests.post(
            OCR_API_URL,
            headers={"accept": "application/json"},
            files={"file": ("crop.jpg", buf, "image/jpeg")},
            timeout=10
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"❌ OCR API failed: {e}")
        return []

class PlayerDataAggregator:
    def __init__(self):
        self.players = {}          # nickname → aggregated stats
        self.processed_images = [] # per-image details

    def add_image_data(self, filename, players_data):
        # record per-image result
        self.processed_images.append({
            "filename":     filename,
            "players":      players_data,
            "player_count": len(players_data)
        })
        # update aggregates
        for p in players_data:
            nick = p["nickname"]
            exp  = p["exp"]
            if nick in self.players:
                entry = self.players[nick]
                entry["totalEXP"]    += exp
                entry["appearances"] += 1
                entry["images"].append(filename)
            else:
                self.players[nick] = {
                    "nickname":      nick,
                    "totalEXP":      exp,
                    "appearances":   1,
                    "bestTime":      "",
                    "timeOverCount": 0,
                    "images":        [filename]
                }

    def get_aggregated_data(self):
        lst       = list(self.players.values())
        total_exp = sum(p["totalEXP"] for p in lst)
        return {
            "players": lst,
            "statistics": {
                "unique_players": len(lst),
                "total_images":   len(self.processed_images),
                "total_exp":      total_exp,
                "avg_exp":        (total_exp // len(lst)) if lst else 0
            },
            "processed_images": self.processed_images
        }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/process", methods=["POST", "OPTIONS"])
def process_images():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    files = request.files.getlist("images")
    if not files or all(f.filename == "" for f in files):
        return jsonify({"error": "No images provided"}), 400

    agg = PlayerDataAggregator()

    for file in files:
        fname = secure_filename(file.filename)
        path  = os.path.join(UPLOAD_DIR, fname)
        file.save(path)

        try:
            img = Image.open(path).convert("RGB")
            players_data = []

            for idx, boxes in enumerate(ROW_BOXES, start=1):
                # 1) OCR EXP first
                exp_crop    = img.crop(boxes["exp"])
                exp_json    = safe_ocr_from_image(exp_crop)
                raw_exp_txt = next(
                    (it["txt"].replace(",", "")
                     for it in exp_json if it["txt"].strip().isdigit()),
                    "0"
                )
                # strip first 5 digits if >10 length
                if len(raw_exp_txt) > 10:
                    raw_exp_txt = raw_exp_txt[5:]
                exp_val = int(raw_exp_txt)

                # only proceed if we detected EXP > 0
                if exp_val <= 0:
                    continue

                # 2) OCR nickname
                nick_crop = img.crop(boxes["nickname"])
                nick_json = safe_ocr_from_image(nick_crop)
                nick_txt  = next(
                    (it["txt"].strip() for it in nick_json if it["txt"].strip()),
                    ""
                )

                # 3) if nickname empty, enlarge crop and retry once
                if not nick_txt:
                    w, h       = nick_crop.size
                    enlarged   = nick_crop.resize((w * 2, h * 2), Image.LANCZOS)
                    nick_json2 = safe_ocr_from_image(enlarged)
                    nick_txt   = next(
                        (it["txt"].strip() for it in nick_json2 if it["txt"].strip()),
                        ""
                    )

                # only include if we now have a nickname
                if nick_txt:
                    players_data.append({
                        "nickname": nick_txt,
                        "exp":      exp_val
                    })

            agg.add_image_data(fname, players_data)

        except Exception as e:
            print(f"❌ Processing failed for {fname}: {e}")
            agg.processed_images.append({
                "filename":     fname,
                "players":      [],
                "player_count": 0,
                "error":        str(e)
            })

        finally:
            os.remove(path)

    out = agg.get_aggregated_data()
    return jsonify({
        "success":            True,
        "processed_images":   out["processed_images"],
        "aggregated_players": out["players"],
        "statistics":         out["statistics"],
        "total_images":       out["statistics"]["total_images"],
        "unique_players":     out["statistics"]["unique_players"]
    })

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
