"""Filter API endpoints."""

import json
import struct

from fastapi import APIRouter, HTTPException, Request, Response

from ..filters.registry import filter_registry

router = APIRouter()


@router.get("")
async def list_filters():
    """List all available filters with their parameters."""
    filters = []
    for filter_id, filter_class in filter_registry.items():
        filters.append(
            {
                "id": filter_id,
                "name": filter_class.name,
                "description": filter_class.description,
                "category": filter_class.category,
                "params": filter_class.get_params_schema(),
            }
        )
    return {"filters": filters}


@router.get("/{filter_id}")
async def get_filter_info(filter_id: str):
    """Get detailed information about a specific filter."""
    if filter_id not in filter_registry:
        raise HTTPException(status_code=404, detail=f"Filter not found: {filter_id}")

    filter_class = filter_registry[filter_id]
    return {
        "id": filter_id,
        "name": filter_class.name,
        "description": filter_class.description,
        "category": filter_class.category,
        "params": filter_class.get_params_schema(),
    }


@router.post("/{filter_id}")
async def apply_filter(filter_id: str, request: Request):
    """Apply a filter to raw image data.

    Request format:
    - First 4 bytes: metadata length (uint32, little-endian)
    - Next N bytes: JSON metadata {"width": int, "height": int, "params": {...}}
    - Remaining bytes: raw RGBA pixel data

    Response:
    - Raw RGBA pixel data (same dimensions as input)
    """
    import numpy as np

    if filter_id not in filter_registry:
        raise HTTPException(status_code=404, detail=f"Filter not found: {filter_id}")

    # Read raw body
    body = await request.body()

    if len(body) < 4:
        raise HTTPException(status_code=400, detail="Request body too short")

    # Parse metadata
    metadata_length = struct.unpack("<I", body[:4])[0]
    if len(body) < 4 + metadata_length:
        raise HTTPException(status_code=400, detail="Invalid metadata length")

    metadata_json = body[4 : 4 + metadata_length].decode("utf-8")
    try:
        metadata = json.loads(metadata_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON metadata: {e}")

    width = metadata.get("width")
    height = metadata.get("height")
    params = metadata.get("params", {})

    if not width or not height:
        raise HTTPException(status_code=400, detail="Missing width or height in metadata")

    # Extract RGBA data
    rgba_data = body[4 + metadata_length :]
    expected_size = width * height * 4
    if len(rgba_data) != expected_size:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image data size. Expected {expected_size}, got {len(rgba_data)}",
        )

    # Convert to numpy array
    image = np.frombuffer(rgba_data, dtype=np.uint8).reshape((height, width, 4)).copy()

    # Apply filter
    filter_instance = filter_registry[filter_id]()
    try:
        result = filter_instance.apply(image, **params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Filter error: {e!s}")

    # Ensure result is correct format
    if result.shape != image.shape:
        raise HTTPException(status_code=500, detail="Filter produced invalid output dimensions")

    # Return raw RGBA bytes
    return Response(content=result.tobytes(), media_type="application/octet-stream")
