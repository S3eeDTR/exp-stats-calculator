# utils/ocr_processor.py
import io
from PIL import Image
import requests
from collections import defaultdict

OCR_API_URL = "https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en"
CROP_BOX    = (700, 530, 1000, 870)

def process_image_ocr(filepath):
    image = Image.open(filepath).convert("RGB")
    cropped = image.crop(CROP_BOX)
    buf = io.BytesIO()
    cropped.save(buf, format="JPEG")
    buf.seek(0)

    resp = requests.post(
      OCR_API_URL,
      headers={'accept': 'application/json'},
      files={'file': ('img.jpg', buf, 'image/jpeg')}
    )
    ocr_data = resp.json()
    # …run the same extract_table(…) code you have in server.py…
    return extract_table(ocr_data)
