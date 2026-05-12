# Local PaddleOCR Service

This service backs every local Smart Import OCR mode:

- Local PP-OCRv5
- Local PaddleOCR-VL
- API PP-OCRv5 / API PaddleOCR-VL when the endpoint points at this service

Install dependencies:

```bash
python3 -m venv .venv-ocr
source .venv-ocr/bin/activate
pip install -r scripts/ocr-service/requirements.txt
```

Install local models:

```bash
npm run ocr:install-models
```

Models are stored in:

```plain
runtime/ocr-models/pp-ocrv5/det
runtime/ocr-models/pp-ocrv5/rec
runtime/ocr-models/paddleocr-vl/vl-rec
runtime/ocr-models/paddleocr-vl/layout
```

Large model files are tracked with Git LFS. If the files are small pointer
files after cloning, run:

```bash
git lfs pull
```

Run:

```bash
npm run ocr:local
```

The Vite dev server proxies `/ocr/price-tag` to `http://localhost:8000`, so the UI can use the default local endpoint.

Request contract:

- `multipart/form-data`
- `image`: uploaded image
- `options`: JSON containing `engine: "pp-ocrv5"` or `engine: "paddleocr-vl"`

Response contract:

```json
{
  "image": { "width": 0, "height": 0 },
  "items": [],
  "provider": "paddle-api-vl",
  "metrics": {}
}
```

The service does not download models at inference time. If a model directory is
missing or still contains Git LFS pointer files, `/ocr/price-tag` returns HTTP
503 with a concrete setup message.
