from __future__ import annotations

import fnmatch
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = Path(os.environ.get("EINK_OCR_MODEL_ROOT", PROJECT_ROOT / "runtime" / "ocr-models")).resolve()

PP_OCRV5_DET_DIR = MODEL_ROOT / "pp-ocrv5" / "det"
PP_OCRV5_REC_DIR = MODEL_ROOT / "pp-ocrv5" / "rec"
PADDLEOCR_VL_DIR = MODEL_ROOT / "paddleocr-vl"
PADDLEOCR_VL_REC_DIR = PADDLEOCR_VL_DIR / "vl-rec"
PADDLEOCR_VL_LAYOUT_DIR = PADDLEOCR_VL_DIR / "layout"

PP_OCRV5_MODEL_CHECKS = (
    ("PP-OCRv5 detection", PP_OCRV5_DET_DIR, ("*.pdmodel", "*.json", "*.onnx", "*.yml", "*.yaml")),
    ("PP-OCRv5 recognition", PP_OCRV5_REC_DIR, ("*.pdmodel", "*.json", "*.onnx", "*.yml", "*.yaml")),
)
PADDLEOCR_VL_MODEL_CHECKS = (
    ("PaddleOCR-VL recognition", PADDLEOCR_VL_REC_DIR, ("*.safetensors", "*.pdparams", "*.json", "*.yml", "*.yaml")),
    ("PaddleOCR-VL layout detection", PADDLEOCR_VL_LAYOUT_DIR, ("*.pdmodel", "*.pdiparams", "*.safetensors", "*.json", "*.yml", "*.yaml")),
)

app = FastAPI(title="Eink Label OCR Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_pp_ocrv5: Any | None = None
_paddleocr_vl: Any | None = None


@app.get("/ocr/health")
async def ocr_health(engine: str | None = None) -> dict[str, Any]:
    engines = {
        "pp-ocrv5": build_engine_health(
            "pp-ocrv5",
            "paddleocr-text-recognition",
            PP_OCRV5_MODEL_CHECKS,
        ),
        "paddleocr-vl": build_engine_health(
            "paddleocr-vl",
            "paddleocr-doc-parsing",
            PADDLEOCR_VL_MODEL_CHECKS,
        ),
    }
    if engine is not None and engine not in engines:
        raise HTTPException(status_code=400, detail=f"Unsupported OCR engine: {engine}")

    selected = engines.get(engine) if engine else None
    return {
        "ready": selected["ready"] if selected else all(item["ready"] for item in engines.values()),
        "modelRoot": str(MODEL_ROOT),
        "selectedEngine": engine,
        "engines": engines,
    }


@app.post("/ocr/price-tag")
async def recognize_price_tag(
    image: UploadFile = File(...),
    options: str = Form("{}"),
    profile: str = Form("{}"),
) -> dict[str, Any]:
    parsed_options = parse_json(options)
    engine = parsed_options.get("engine") or parsed_options.get("model") or "pp-ocrv5"
    provider_mode = parsed_options.get("providerMode") or (
        "local-vl" if engine == "paddleocr-vl" else "local-v5"
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

        items = normalize_items(raw, size)
        return {
            "image": {"width": size[0], "height": size[1]},
            "items": items,
            "provider": provider_mode,
            "metrics": {
                "engine": engine,
                "modelRoot": str(MODEL_ROOT),
                "profile": parse_json(profile),
                "itemCount": len(items),
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
        ensure_model_dir("PP-OCRv5 detection", PP_OCRV5_DET_DIR)
        ensure_model_dir("PP-OCRv5 recognition", PP_OCRV5_REC_DIR)
        try:
            from paddleocr import PaddleOCR
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"PaddleOCR is not installed: {exc}") from exc

        kwargs = {
            "lang": "ch",
            "ocr_version": "PP-OCRv5",
            "text_detection_model_name": "PP-OCRv5_mobile_det",
            "text_detection_model_dir": str(PP_OCRV5_DET_DIR),
            "text_recognition_model_name": "PP-OCRv5_mobile_rec",
            "text_recognition_model_dir": str(PP_OCRV5_REC_DIR),
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        }
        try:
            _pp_ocrv5 = PaddleOCR(**kwargs)
        except TypeError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The installed PaddleOCR version does not support local PP-OCRv5 model "
                    f"directory options. Upgrade paddleocr. Original error: {exc}"
                ),
            ) from exc
    return _pp_ocrv5.predict(str(path))


def predict_with_paddleocr_vl(path: Path) -> Any:
    global _paddleocr_vl
    if _paddleocr_vl is None:
        ensure_model_dir("PaddleOCR-VL recognition", PADDLEOCR_VL_REC_DIR)
        ensure_model_dir("PaddleOCR-VL layout", PADDLEOCR_VL_LAYOUT_DIR)
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

        kwargs = {
            "vl_rec_model_dir": str(PADDLEOCR_VL_REC_DIR),
            "layout_detection_model_dir": str(PADDLEOCR_VL_LAYOUT_DIR),
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_layout_detection": True,
        }
        try:
            _paddleocr_vl = PaddleOCRVL(**kwargs)
        except TypeError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "The installed PaddleOCR version does not support local PaddleOCR-VL "
                    f"model directory options. Upgrade paddleocr. Original error: {exc}"
                ),
            ) from exc
    if hasattr(_paddleocr_vl, "predict"):
        return _paddleocr_vl.predict(str(path))
    raise HTTPException(status_code=503, detail="PaddleOCRVL runtime does not expose predict().")


def ensure_model_dir(label: str, path: Path) -> None:
    if not path.exists():
        raise missing_model_error(label, path)
    files = [file for file in path.rglob("*") if file.is_file() and file.name != ".gitkeep"]
    if not files:
        raise missing_model_error(label, path)
    lfs_pointer = next((file for file in files if is_git_lfs_pointer(file)), None)
    if lfs_pointer:
        raise HTTPException(
            status_code=503,
            detail=(
                f"{label} model file is still a Git LFS pointer: {lfs_pointer}. "
                "Run `git lfs pull` or `npm run ocr:install-models`."
            ),
        )


def build_engine_health(
    engine: str,
    label: str,
    checks: tuple[tuple[str, Path, tuple[str, ...]], ...],
) -> dict[str, Any]:
    directory_checks = [
        inspect_model_dir(check_label, path, required_any)
        for check_label, path, required_any in checks
    ]
    return {
        "engine": engine,
        "label": label,
        "ready": all(item["ready"] for item in directory_checks),
        "checks": directory_checks,
    }


def inspect_model_dir(label: str, path: Path, required_any: tuple[str, ...]) -> dict[str, Any]:
    if not path.exists():
        return model_dir_result(label, path, False, "missing", 0, f"{label} model directory is missing.")

    files = [file for file in path.rglob("*") if file.is_file() and file.name != ".gitkeep"]
    required_files = [
        file for file in files
        if any(fnmatch.fnmatch(file.name, pattern) for pattern in required_any)
    ]
    if not required_files:
        expected = ", ".join(required_any)
        return model_dir_result(
            label,
            path,
            False,
            "missing",
            len(files),
            f"{label} model files are missing. Expected one of: {expected}.",
        )

    lfs_pointer = next((file for file in required_files if is_git_lfs_pointer(file)), None)
    if lfs_pointer:
        return model_dir_result(
            label,
            path,
            False,
            "lfs-pointer",
            len(files),
            f"{label} model file is still a Git LFS pointer: {lfs_pointer}.",
        )

    return model_dir_result(label, path, True, "ready", len(files), f"{label} model files are ready.")


def model_dir_result(
    label: str,
    path: Path,
    ready: bool,
    status: str,
    file_count: int,
    message: str,
) -> dict[str, Any]:
    return {
        "label": label,
        "path": str(path),
        "ready": ready,
        "status": status,
        "fileCount": file_count,
        "message": message,
    }


def missing_model_error(label: str, path: Path) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=(
            f"{label} model files are missing at {path}. "
            "Run `npm run ocr:install-models`, or pull the Git LFS files with `git lfs pull`."
        ),
    )


def is_git_lfs_pointer(path: Path) -> bool:
    try:
        if path.stat().st_size > 512:
            return False
        return path.read_text(encoding="utf-8", errors="ignore").startswith(
            "version https://git-lfs.github.com/spec/v1"
        )
    except OSError:
        return False


def normalize_items(raw: Any, image_size: tuple[int, int]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for result in flatten_results(raw):
        items.extend(parse_result(result, image_size))

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        normalized.append({
            "id": item.get("id") or f"ocr_{index + 1}",
            "text": text,
            "score": safe_float(item.get("score"), 1),
            "poly": normalize_poly(item.get("poly") or item.get("box") or item.get("bbox"), index, image_size),
        })
    return normalized


def flatten_results(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if isinstance(raw, (list, tuple)):
        flattened: list[Any] = []
        for item in raw:
            flattened.extend(flatten_results(item))
        return flattened
    return [raw]


def parse_result(result: Any, image_size: tuple[int, int]) -> list[dict[str, Any]]:
    data = unwrap_result(result)
    if isinstance(data, list):
        parsed: list[dict[str, Any]] = []
        for item in data:
            parsed.extend(parse_result(item, image_size))
        return parsed
    if not isinstance(data, dict):
        return []

    if isinstance(data.get("parsing_res_list"), list):
        return parse_vl_parsing_list(data["parsing_res_list"])

    texts = first_list(data, ["rec_texts", "texts", "text"])
    scores = first_list(data, ["rec_scores", "scores", "score"])
    polys = first_list(data, ["rec_polys", "dt_polys", "polys", "boxes", "bboxes"])

    if isinstance(texts, str):
        return [{
            "text": texts,
            "score": scores,
            "poly": polys,
        }]
    if not isinstance(texts, list):
        direct_text = first_text_value(data)
        if direct_text:
            return [{
                "text": direct_text,
                "score": data.get("score") or data.get("confidence"),
                "poly": data.get("poly") or data.get("box") or data.get("bbox") or data.get("block_bbox"),
            }]
        return []

    normalized: list[dict[str, Any]] = []
    for index, text in enumerate(texts):
        normalized.append({
            "text": text,
            "score": scores[index] if isinstance(scores, list) and index < len(scores) else scores,
            "poly": polys[index] if isinstance(polys, list) and index < len(polys) else polys,
        })
    return normalized


def unwrap_result(result: Any) -> Any:
    data = result
    if hasattr(data, "json"):
        try:
            json_value = data.json
            data = json_value() if callable(json_value) else json_value
        except Exception:
            pass
    if hasattr(data, "res"):
        data = data.res
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return data
    if isinstance(data, dict) and isinstance(data.get("res"), dict):
        data = data["res"]
    return data


def parse_vl_parsing_list(items: list[Any]) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for item in items:
        data = unwrap_result(item)
        if not isinstance(data, dict):
            continue
        text = first_text_value(data)
        if not text:
            continue
        parsed.append({
            "text": text,
            "score": data.get("score") or data.get("confidence"),
            "poly": data.get("poly") or data.get("bbox") or data.get("block_bbox") or data.get("box"),
        })
    return parsed


def first_text_value(data: dict[str, Any]) -> str | None:
    for key in ["text", "content", "block_content", "rec_text", "markdown", "value"]:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def first_list(data: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in data:
            return data[key]
    return None


def normalize_poly(value: Any, index: int, image_size: tuple[int, int]) -> list[list[float]]:
    if isinstance(value, list):
        if len(value) == 4 and all(is_number(item) for item in value):
            left, top, right_or_width, bottom_or_height = [safe_float(item, 0) for item in value]
            right = right_or_width if right_or_width > left else left + right_or_width
            bottom = bottom_or_height if bottom_or_height > top else top + bottom_or_height
            return [[left, top], [right, top], [right, bottom], [left, bottom]]

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


def is_number(value: Any) -> bool:
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def safe_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, app_dir=str(Path(__file__).parent))
