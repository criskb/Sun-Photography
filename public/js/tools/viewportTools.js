import { elements } from '../ui/dom.js';

export class ViewportTools {
  constructor({ getMode, onRotate, onDrawPoint, redraw }) {
    this.getMode = getMode;
    this.onRotate = onRotate;
    this.onDrawPoint = onDrawPoint;
    this.redraw = redraw;
    this.pointer = { isDown: false, x: 0, y: 0 };
  }

  init() {
    const canvas = elements.drawCanvas;

    canvas.addEventListener('pointerdown', (event) => {
      this.pointer.isDown = true;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);

      if (this.getMode() === 'draw') {
        this.pushDrawPoint(event);
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.pointer.isDown) return;

      if (this.getMode() === 'draw') {
        this.pushDrawPoint(event);
        return;
      }

      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      this.onRotate(dx, dy);
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
    });

    const stop = () => {
      this.pointer.isDown = false;
    };

    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  pushDrawPoint(event) {
    const rect = elements.drawCanvas.getBoundingClientRect();
    this.onDrawPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    this.redraw();
  }
}

export function drawOverlay(points) {
  const ctx = elements.drawCanvas.getContext('2d');
  ctx.clearRect(0, 0, elements.drawCanvas.width, elements.drawCanvas.height);

  if (points.length < 2) return;

  ctx.strokeStyle = '#67d6ff';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}
