from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import uvicorn

app = FastAPI(title="Eink Label OCR Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pp_ocrv5: Any | None = None
_paddleocr_vl: Any | None = None


@app.post("/ocr/price-tag")
async def recognize_price_tag(
    image: UploadFile = File(...),
    options: str = Form("{}"),
    profile: str = Form("{}"),
) -> dict[str, Any]:
    parsed_options = parse_json(options)
    engine = parsed_options.get("engine") or parsed_options.get("model") or "pp-ocrv5"
    provider_mode = parsed_options.get("providerMode") or (
        "paddle-api-vl" if engine == "paddleocr-vl" else "paddle-api-v5"
    )

    suffix = Path(image.filename or "price-tag.png").suffix or ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        tmp.write(await image.read())

    try:
        size = read_image_size(tmp_path)
        if engine == "paddleocr-vl":
            raw = predict_with_paddleocr_vl(tmp_path)
        elif engine == "pp-ocrv5":
            raw = predict_with_pp_ocrv5(tmp_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported OCR engine: {engine}")

        return {
            "image": {"width": size[0], "height": size[1]},
            "items": normalize_items(raw, size),
            "provider": provider_mode,
            "metrics": {
                "engine": engine,
                "profile": parse_json(profile),
            },
        }
    finally:
        tmp_path.unlink(missing_ok=True)


def parse_json(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value) if value else {}
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def read_image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as img:
        return img.size


def predict_with_pp_ocrv5(path: Path) -> Any:
    global _pp_ocrv5
    if _pp_ocrv5 is None:
        try:
            from paddleocr import PaddleOCR
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"PaddleOCR is not installed: {exc}") from exc

        try:
            _pp_ocrv5 = PaddleOCR(
                lang="ch",
                ocr_version="PP-OCRv5",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except TypeError:
            _pp_ocrv5 = PaddleOCR(lang="ch", ocr_version="PP-OCRv5")
    return _pp_ocrv5.predict(str(path))


def predict_with_paddleocr_vl(path: Path) -> Any:
    global _paddleocr_vl
    if _paddleocr_vl is None:
        try:
            from paddleocr import PaddleOCRVL
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "PaddleOCR-VL is not available in this Python environment. "
                    "Install a PaddleOCR build that exposes PaddleOCRVL."
                ),
            ) from exc

        _paddleocr_vl = PaddleOCRVL()
    if hasattr(_paddleocr_vl, "predict"):
        return _paddleocr_vl.predict(str(path))
    raise HTTPException(status_code=503, detail="PaddleOCRVL runtime does not expose predict().")


def normalize_items(raw: Any, image_size: tuple[int, int]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for result in flatten_results(raw):
        parsed = parse_result_dict(result, image_size)
        if parsed:
            items.extend(parsed)
    return items


def flatten_results(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        flattened: list[Any] = []
        for item in raw:
            flattened.extend(flatten_results(item))
        return flattened
    return [raw]


def parse_result_dict(result: Any, image_size: tuple[int, int]) -> list[dict[str, Any]]:
    data = result
    if hasattr(result, "json"):
        try:
            data = result.json
        except Exception:
            data = result
    if hasattr(data, "res"):
        data = data.res
    if not isinstance(data, dict):
        return []

    texts = first_list(data, ["rec_texts", "texts", "text"])
    scores = first_list(data, ["rec_scores", "scores", "score"])
    polys = first_list(data, ["rec_polys", "dt_polys", "polys", "boxes"])

    if isinstance(texts, str):
        texts = [texts]
    if not isinstance(texts, list):
        return []

    normalized: list[dict[str, Any]] = []
    for index, text in enumerate(texts):
        if text is None or str(text).strip() == "":
            continue
        poly = normalize_poly(polys[index] if isinstance(polys, list) and index < len(polys) else None, index, image_size)
        score = scores[index] if isinstance(scores, list) and index < len(scores) else 1
        normalized.append({
            "id": f"ocr_{index + 1}",
            "text": str(text),
            "score": safe_float(score, 1),
            "poly": poly,
        })
    return normalized


def first_list(data: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in data:
            return data[key]
    return None


def normalize_poly(value: Any, index: int, image_size: tuple[int, int]) -> list[list[float]]:
    if isinstance(value, list) and len(value) >= 4:
        points = []
        for point in value[:4]:
            if isinstance(point, (list, tuple)) and len(point) >= 2:
                points.append([safe_float(point[0], 0), safe_float(point[1], 0)])
        if len(points) == 4:
            return points

    width, height = image_size
    row_height = max(12, height * 0.05)
    top = min(height - row_height, index * row_height)
    return [[0, top], [width, top], [width, top + row_height], [0, top + row_height]]


def safe_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, app_dir=str(Path(__file__).parent))
