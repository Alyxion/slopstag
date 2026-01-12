"""Color adjustment filters."""

import numpy as np
from skimage import color as skcolor

from .base import BaseFilter
from .registry import register_filter


@register_filter("grayscale")
class GrayscaleFilter(BaseFilter):
    """Convert to grayscale."""

    name = "Grayscale"
    description = "Convert image to grayscale"
    category = "color"

    @classmethod
    def get_params_schema(cls):
        return []

    def apply(self, image: np.ndarray) -> np.ndarray:
        rgb = image[:, :, :3]
        gray = skcolor.rgb2gray(rgb)
        gray = (gray * 255).astype(np.uint8)

        result = np.stack([gray, gray, gray, image[:, :, 3]], axis=2)
        return result


@register_filter("invert")
class InvertFilter(BaseFilter):
    """Invert colors."""

    name = "Invert Colors"
    description = "Invert all colors in the image"
    category = "color"

    @classmethod
    def get_params_schema(cls):
        return []

    def apply(self, image: np.ndarray) -> np.ndarray:
        result = image.copy()
        result[:, :, :3] = 255 - image[:, :, :3]
        return result


@register_filter("brightness_contrast")
class BrightnessContrastFilter(BaseFilter):
    """Adjust brightness and contrast."""

    name = "Brightness/Contrast"
    description = "Adjust image brightness and contrast"
    category = "color"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "brightness",
                "name": "Brightness",
                "type": "range",
                "min": -100,
                "max": 100,
                "step": 1,
                "default": 0,
            },
            {
                "id": "contrast",
                "name": "Contrast",
                "type": "range",
                "min": -100,
                "max": 100,
                "step": 1,
                "default": 0,
            },
        ]

    def apply(self, image: np.ndarray, brightness: int = 0, contrast: int = 0) -> np.ndarray:
        result = image.copy().astype(np.float32)

        # Apply brightness
        result[:, :, :3] += brightness * 2.55  # Scale to 0-255 range

        # Apply contrast
        factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
        result[:, :, :3] = factor * (result[:, :, :3] - 128) + 128

        # Clamp and convert back
        result = np.clip(result, 0, 255).astype(np.uint8)
        return result


@register_filter("sepia")
class SepiaFilter(BaseFilter):
    """Apply sepia tone."""

    name = "Sepia"
    description = "Apply vintage sepia tone effect"
    category = "color"

    @classmethod
    def get_params_schema(cls):
        return [
            {
                "id": "intensity",
                "name": "Intensity",
                "type": "range",
                "min": 0,
                "max": 100,
                "step": 1,
                "default": 100,
            }
        ]

    def apply(self, image: np.ndarray, intensity: int = 100) -> np.ndarray:
        result = image.copy().astype(np.float32)
        factor = intensity / 100.0

        r = result[:, :, 0]
        g = result[:, :, 1]
        b = result[:, :, 2]

        # Sepia transformation matrix
        new_r = r * (1 - factor) + (r * 0.393 + g * 0.769 + b * 0.189) * factor
        new_g = g * (1 - factor) + (r * 0.349 + g * 0.686 + b * 0.168) * factor
        new_b = b * (1 - factor) + (r * 0.272 + g * 0.534 + b * 0.131) * factor

        result[:, :, 0] = np.clip(new_r, 0, 255)
        result[:, :, 1] = np.clip(new_g, 0, 255)
        result[:, :, 2] = np.clip(new_b, 0, 255)

        return result.astype(np.uint8)
