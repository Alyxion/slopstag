"""Sharpen filters."""

import numpy as np
from skimage.filters import unsharp_mask

from .base import BaseFilter
from .registry import register_filter


@register_filter("unsharp_mask")
class UnsharpMaskFilter(BaseFilter):
    """Unsharp mask sharpening filter."""

    name = "Unsharp Mask"
    description = "Sharpen image using unsharp masking"
    category = "sharpen"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "radius",
                "name": "Radius",
                "type": "range",
                "min": 0.1,
                "max": 10.0,
                "step": 0.1,
                "default": 1.0,
            },
            {
                "id": "amount",
                "name": "Amount",
                "type": "range",
                "min": 0.1,
                "max": 5.0,
                "step": 0.1,
                "default": 1.0,
            },
        ]

    def apply(self, image: np.ndarray, radius: float = 1.0, amount: float = 1.0) -> np.ndarray:
        # Process RGB channels, preserve alpha
        rgb = image[:, :, :3].astype(np.float32) / 255.0
        alpha = image[:, :, 3]

        sharpened = unsharp_mask(rgb, radius=radius, amount=amount, channel_axis=2)
        sharpened = np.clip(sharpened * 255, 0, 255).astype(np.uint8)

        result = np.concatenate([sharpened, alpha[:, :, np.newaxis]], axis=2)
        return result
