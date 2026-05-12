# Local PaddleOCR Service

This service backs the Smart Import modes that need a local Python runtime:

- Local PaddleOCR-VL
- API PP-OCRv5 / API PaddleOCR-VL when the endpoint points at this service

Install dependencies:

```bash
python3 -m venv .venv-ocr
source .venv-ocr/bin/activate
pip install -r scripts/ocr-service/requirements.txt
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

PaddleOCR-VL model weights are intentionally not committed to the repo because they are much larger than the browser PP-OCRv5 tar assets. PaddleOCR will manage its own local model cache when the service starts or first runs inference.
