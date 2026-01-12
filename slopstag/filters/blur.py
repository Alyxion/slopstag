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


@register_filter("median_blur")
class MedianBlurFilter(BaseFilter):
    """Median blur filter - good for noise reduction."""

    name = "Median Blur"
    description = "Apply median filter to reduce noise while preserving edges"
    category = "blur"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "size",
                "name": "Kernel Size",
                "type": "range",
                "min": 1,
                "max": 21,
                "step": 2,
                "default": 3,
            }
        ]

    def apply(self, image: np.ndarray, size: int = 3) -> np.ndarray:
        # Ensure odd kernel size
        size = size if size % 2 == 1 else size + 1
        result = image.copy()
        for c in range(3):  # RGB only
            result[:, :, c] = ndimage.median_filter(image[:, :, c], size=size)
        return result


@register_filter("bilateral_blur")
class BilateralBlurFilter(BaseFilter):
    """Bilateral filter - edge-preserving smoothing."""

    name = "Bilateral Filter"
    description = "Edge-preserving smoothing that reduces noise while keeping edges sharp"
    category = "blur"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "sigma_color",
                "name": "Color Sigma",
                "type": "range",
                "min": 1,
                "max": 150,
                "step": 1,
                "default": 75,
            },
            {
                "id": "sigma_spatial",
                "name": "Spatial Sigma",
                "type": "range",
                "min": 1,
                "max": 50,
                "step": 1,
                "default": 10,
            },
        ]

    def apply(self, image: np.ndarray, sigma_color: int = 75, sigma_spatial: int = 10) -> np.ndarray:
        import cv2

        # OpenCV uses BGR, so convert
        rgb = image[:, :, :3]
        alpha = image[:, :, 3]

        # Apply bilateral filter
        filtered = cv2.bilateralFilter(rgb, d=-1, sigmaColor=sigma_color, sigmaSpace=sigma_spatial)

        result = np.concatenate([filtered, alpha[:, :, np.newaxis]], axis=2)
        return result


@register_filter("motion_blur")
class MotionBlurFilter(BaseFilter):
    """Motion blur filter."""

    name = "Motion Blur"
    description = "Apply directional motion blur effect"
    category = "blur"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "size",
                "name": "Blur Length",
                "type": "range",
                "min": 3,
                "max": 50,
                "step": 1,
                "default": 15,
            },
            {
                "id": "angle",
                "name": "Angle",
                "type": "range",
                "min": 0,
                "max": 360,
                "step": 1,
                "default": 0,
            },
        ]

    def apply(self, image: np.ndarray, size: int = 15, angle: int = 0) -> np.ndarray:
        import cv2

        # Create motion blur kernel
        kernel = np.zeros((size, size))
        kernel[size // 2, :] = np.ones(size)
        kernel = kernel / size

        # Rotate kernel by angle
        center = (size / 2, size / 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        kernel = cv2.warpAffine(kernel, rotation_matrix, (size, size))
        kernel = kernel / kernel.sum()  # Normalize

        rgb = image[:, :, :3]
        alpha = image[:, :, 3]

        filtered = cv2.filter2D(rgb, -1, kernel)

        result = np.concatenate([filtered, alpha[:, :, np.newaxis]], axis=2)
        return result
