"""Edge detection filters."""

import numpy as np
from skimage import filters
from skimage.feature import canny

from .base import BaseFilter
from .registry import register_filter


@register_filter("sobel_edge")
class SobelEdgeFilter(BaseFilter):
    """Sobel edge detection filter."""

    name = "Sobel Edge Detection"
    description = "Detect edges using Sobel operator"
    category = "edge"

    @classmethod
    def get_params_schema(cls):
        return []

    def apply(self, image: np.ndarray) -> np.ndarray:
        # Convert to grayscale for edge detection
        gray = np.mean(image[:, :, :3], axis=2).astype(np.float32) / 255.0

        edges = filters.sobel(gray)
        edges = (np.clip(edges, 0, 1) * 255).astype(np.uint8)

        # Convert back to RGBA
        result = np.stack([edges, edges, edges, image[:, :, 3]], axis=2)
        return result


@register_filter("canny_edge")
class CannyEdgeFilter(BaseFilter):
    """Canny edge detection filter."""

    name = "Canny Edge Detection"
    description = "Detect edges using Canny algorithm"
    category = "edge"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "sigma",
                "name": "Sigma",
                "type": "range",
                "min": 0.1,
                "max": 5.0,
                "step": 0.1,
                "default": 1.0,
            },
            {
                "id": "low_threshold",
                "name": "Low Threshold",
                "type": "range",
                "min": 0.0,
                "max": 1.0,
                "step": 0.01,
                "default": 0.1,
            },
            {
                "id": "high_threshold",
                "name": "High Threshold",
                "type": "range",
                "min": 0.0,
                "max": 1.0,
                "step": 0.01,
                "default": 0.2,
            },
        ]

    def apply(
        self,
        image: np.ndarray,
        sigma: float = 1.0,
        low_threshold: float = 0.1,
        high_threshold: float = 0.2,
    ) -> np.ndarray:
        gray = np.mean(image[:, :, :3], axis=2).astype(np.float32) / 255.0
        edges = canny(gray, sigma=sigma, low_threshold=low_threshold, high_threshold=high_threshold)
        edges = (edges * 255).astype(np.uint8)

        result = np.stack([edges, edges, edges, image[:, :, 3]], axis=2)
        return result
