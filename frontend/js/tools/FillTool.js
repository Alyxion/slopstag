/**
 * FillTool - Flood fill (paint bucket).
 */
import { Tool } from './Tool.js';

export class FillTool extends Tool {
    static id = 'fill';
    static name = 'Paint Bucket';
    static icon = 'fill';
    static shortcut = 'g';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);
        this.tolerance = 32; // 0-255
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // Round coordinates
        x = Math.floor(x);
        y = Math.floor(y);

        // Check bounds
        if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) return;

        // Save state for undo
        this.app.history.saveState('fill');

        // Get fill color
        const fillColor = this.app.foregroundColor || '#000000';
        const fillRgba = this.hexToRgba(fillColor);

        // Perform flood fill
        this.floodFill(layer, x, y, fillRgba);
        this.app.renderer.requestRender();
    }

    floodFill(layer, startX, startY, fillColor) {
        const imageData = layer.getImageData();
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Get target color at click position
        const targetIdx = (startY * width + startX) * 4;
        const targetColor = {
            r: data[targetIdx],
            g: data[targetIdx + 1],
            b: data[targetIdx + 2],
            a: data[targetIdx + 3]
        };

        // Don't fill if clicking on the same color
        if (this.colorsMatch(targetColor, fillColor, 0)) return;

        // Stack-based flood fill
        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            // Check bounds
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            // Check if visited
            const key = y * width + x;
            if (visited.has(key)) continue;
            visited.add(key);

            const idx = key * 4;
            const currentColor = {
                r: data[idx],
                g: data[idx + 1],
                b: data[idx + 2],
                a: data[idx + 3]
            };

            // Check if color matches target within tolerance
            if (!this.colorsMatch(currentColor, targetColor, this.tolerance)) continue;

            // Fill pixel
            data[idx] = fillColor.r;
            data[idx + 1] = fillColor.g;
            data[idx + 2] = fillColor.b;
            data[idx + 3] = fillColor.a;

            // Add neighbors
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }

        layer.setImageData(imageData);
    }

    colorsMatch(c1, c2, tolerance) {
        return Math.abs(c1.r - c2.r) <= tolerance &&
               Math.abs(c1.g - c2.g) <= tolerance &&
               Math.abs(c1.b - c2.b) <= tolerance &&
               Math.abs(c1.a - c2.a) <= tolerance;
    }

    hexToRgba(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b, a: 255 };
    }

    getProperties() {
        return [
            { id: 'tolerance', name: 'Tolerance', type: 'range', min: 0, max: 255, step: 1, value: this.tolerance }
        ];
    }
}
