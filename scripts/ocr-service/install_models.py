from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = PROJECT_ROOT / "runtime" / "ocr-models"


@dataclass(frozen=True)
class ModelSpec:
    name: str
    repo_id: str
    target: Path
    required_any: tuple[str, ...]
    allow_patterns: tuple[str, ...] | None = None


MODELS = (
    ModelSpec(
        name="PP-OCRv5 text detection",
        repo_id="PaddlePaddle/PP-OCRv5_mobile_det",
        target=MODEL_ROOT / "pp-ocrv5" / "det",
        required_any=("*.pdmodel", "*.json", "*.onnx", "*.yml", "*.yaml"),
    ),
    ModelSpec(
        name="PP-OCRv5 text recognition",
        repo_id="PaddlePaddle/PP-OCRv5_mobile_rec",
        target=MODEL_ROOT / "pp-ocrv5" / "rec",
        required_any=("*.pdmodel", "*.json", "*.onnx", "*.yml", "*.yaml"),
    ),
    ModelSpec(
        name="PaddleOCR-VL recognition",
        repo_id="PaddlePaddle/PaddleOCR-VL-1.5",
        target=MODEL_ROOT / "paddleocr-vl" / "vl-rec",
        required_any=("*.safetensors", "*.pdparams", "*.json", "*.yml", "*.yaml"),
    ),
    ModelSpec(
        name="PaddleOCR-VL layout detection",
        repo_id="PaddlePaddle/PP-DocLayoutV3",
        target=MODEL_ROOT / "paddleocr-vl" / "layout",
        required_any=("*.pdmodel", "*.pdiparams", "*.safetensors", "*.json", "*.yml", "*.yaml"),
    ),
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Install local OCR models into runtime/ocr-models.")
    parser.add_argument("--model-root", type=Path, default=MODEL_ROOT)
    parser.add_argument("--skip-lfs-check", action="store_true")
    parser.add_argument("--no-sha256", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    if args.model_root != MODEL_ROOT:
        remapped = []
        for spec in MODELS:
            rel = spec.target.relative_to(MODEL_ROOT)
            remapped.append(ModelSpec(spec.name, spec.repo_id, args.model_root / rel, spec.required_any, spec.allow_patterns))
        specs = tuple(remapped)
    else:
        specs = MODELS

    if not args.skip_lfs_check:
        require_git_lfs()

    if args.verify_only:
        verify_all_required_files(specs)
        verify_checksums(args.model_root)
        print(f"Local OCR models are present and checksums are valid in {args.model_root}")
        return 0

    try:
        from huggingface_hub import snapshot_download
    except Exception as exc:
        print("Missing huggingface_hub. Run: pip install -r scripts/ocr-service/requirements.txt", file=sys.stderr)
        print(f"Original error: {exc}", file=sys.stderr)
        return 2

    for spec in specs:
        install_model(spec, snapshot_download)

    if not args.no_sha256:
        checksum_path = args.model_root / "SHA256SUMS"
        if checksum_path.exists():
            verify_checksums(args.model_root)
        else:
            write_checksums(args.model_root)

    print(f"Local OCR models are installed in {args.model_root}")
    return 0


def require_git_lfs() -> None:
    if shutil.which("git-lfs") is None and not git_lfs_subcommand_available():
        raise SystemExit(
            "Git LFS is required for runtime/ocr-models. Install Git LFS, then run `git lfs install`."
        )


def git_lfs_subcommand_available() -> bool:
    try:
        result = subprocess.run(
            ["git", "lfs", "version"],
            cwd=PROJECT_ROOT,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return result.returncode == 0
    except OSError:
        return False


def install_model(spec: ModelSpec, snapshot_download) -> None:
    spec.target.mkdir(parents=True, exist_ok=True)
    print(f"Installing {spec.name} from {spec.repo_id} -> {spec.target}")
    snapshot_download(
        repo_id=spec.repo_id,
        local_dir=spec.target,
        local_dir_use_symlinks=False,
        allow_patterns=list(spec.allow_patterns) if spec.allow_patterns else None,
    )
    verify_required_files(spec)


def verify_required_files(spec: ModelSpec) -> None:
    if any(list_files(spec.target, pattern) for pattern in spec.required_any):
        return
    expected = ", ".join(spec.required_any)
    raise SystemExit(f"{spec.name} did not install expected model files in {spec.target}. Expected one of: {expected}")


def verify_all_required_files(specs: Iterable[ModelSpec]) -> None:
    for spec in specs:
        verify_required_files(spec)


def list_files(root: Path, pattern: str) -> list[Path]:
    return [path for path in root.rglob(pattern) if path.is_file()]


def verify_checksums(model_root: Path) -> None:
    checksum_path = model_root / "SHA256SUMS"
    if not checksum_path.exists():
        raise SystemExit(f"Missing checksum file: {checksum_path}")

    for line_number, raw_line in enumerate(checksum_path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            expected, relative = line.split(None, 1)
        except ValueError as exc:
            raise SystemExit(f"Invalid checksum line {line_number}: {raw_line}") from exc
        path = model_root / relative.strip()
        if not path.exists():
            raise SystemExit(f"Checksum target is missing: {path}")
        actual = sha256(path)
        if actual != expected:
            raise SystemExit(f"Checksum mismatch for {path}: expected {expected}, got {actual}")


def write_checksums(model_root: Path) -> None:
    checksum_path = model_root / "SHA256SUMS"
    files = sorted(
        path for path in model_root.rglob("*")
        if path.is_file()
        and path.name != "SHA256SUMS"
        and ".cache" not in path.parts
    )
    checksum_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{sha256(path)}  {path.relative_to(model_root).as_posix()}" for path in files]
    checksum_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    print(f"Wrote {checksum_path}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
