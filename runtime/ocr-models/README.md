# Local OCR Models

This directory is the runtime model store for Smart Import.

Expected layout:

```plain
runtime/ocr-models/
  pp-ocrv5/
    det/
    rec/
  paddleocr-vl/
    vl-rec/
    layout/
```

Install models with:

```bash
npm run ocr:install-models
```

Large model files under this directory are tracked with Git LFS. If model files
look like small text pointers, run:

```bash
git lfs pull
```
