"""Blur filters."""

import numpy as np
from scipy import ndimage
from skimage.filters import gaussian

from .base import BaseFilter
from .registry import register_filter


@register_filter("gaussian_blur")
class GaussianBlurFilter(BaseFilter):
    """Gaussian blur filter."""

    name = "Gaussian Blur"
    description = "Apply Gaussian blur to soften the image"
    category = "blur"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "sigma",
                "name": "Blur Radius",
                "type": "range",
                "min": 0.1,
                "max": 20.0,
                "step": 0.1,
                "default": 3.0,
            }
        ]

    def apply(self, image: np.ndarray, sigma: float = 3.0) -> np.ndarray:
        # Process RGB channels, preserve alpha
        rgb = image[:, :, :3].astype(np.float32) / 255.0
        alpha = image[:, :, 3]

        blurred_rgb = gaussian(rgb, sigma=sigma, channel_axis=2)
        blurred_rgb = (blurred_rgb * 255).astype(np.uint8)

        result = np.concatenate([blurred_rgb, alpha[:, :, np.newaxis]], axis=2)
        return result


@register_filter("box_blur")
class BoxBlurFilter(BaseFilter):
    """Box (uniform) blur filter."""

    name = "Box Blur"
    description = "Apply uniform box blur"
    category = "blur"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "size",
                "name": "Kernel Size",
                "type": "range",
                "min": 1,
                "max": 50,
                "step": 1,
                "default": 5,
            }
        ]

    def apply(self, image: np.ndarray, size: int = 5) -> np.ndarray:
        result = image.copy()
        for c in range(3):  # RGB only
            result[:, :, c] = ndimage.uniform_filter(image[:, :, c], size=size)
        return result
