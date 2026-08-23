import React, { useCallback, useEffect, useRef, useState } from "react";

type MaskTool = "paint" | "erase";

type Point = {
  x: number;
  y: number;
};

export interface ImageMaskEditorProps {
  src: string;
  onMaskChange: (maskDataUrl: string | undefined) => void;
}

const MAX_MASK_DIMENSION = 1024;

export const ImageMaskEditor: React.FC<ImageMaskEditorProps> = ({ src, onMaskChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [tool, setTool] = useState<MaskTool>("paint");
  const [brushSize, setBrushSize] = useState(48);
  const [stageSize, setStageSize] = useState({ width: 520, height: 520 });

  const publishMask = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasSelection = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        hasSelection = true;
        break;
      }
    }
    if (!hasSelection) {
      onMaskChange(undefined);
      return;
    }

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const outputContext = output.getContext("2d");
    if (!outputContext) return;
    outputContext.fillStyle = "#000";
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(canvas, 0, 0);
    onMaskChange(output.toDataURL("image/png"));
  }, [onMaskChange]);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onMaskChange(undefined);
  }, [onMaskChange]);

  const initializeCanvas = useCallback((image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const scale = Math.min(
      1,
      MAX_MASK_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const displayScale = Math.min(
      1,
      520 / image.naturalWidth,
      520 / image.naturalHeight
    );
    setStageSize({
      width: Math.max(1, Math.round(image.naturalWidth * displayScale)),
      height: Math.max(1, Math.round(image.naturalHeight * displayScale)),
    });
    onMaskChange(undefined);
  }, [onMaskChange]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete) initializeCanvas(image);
  }, [initializeCanvas, src]);

  const eventPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const drawSegment = (canvas: HTMLCanvasElement, from: Point, to: Point) => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const displayScale = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    context.save();
    context.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
    context.strokeStyle = "#fff";
    context.fillStyle = "#fff";
    context.lineWidth = brushSize * displayScale;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    if (from.x === to.x && from.y === to.y) {
      context.beginPath();
      context.arc(to.x, to.y, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = eventPoint(event);
    drawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(event.currentTarget, point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    event.preventDefault();
    const point = eventPoint(event);
    drawSegment(event.currentTarget, lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    publishMask();
  };

  return (
    <div className="image-mask-editor">
      <div
        className="image-mask-stage"
        style={{
          width: `min(100%, ${stageSize.width}px)`,
          aspectRatio: `${stageSize.width} / ${stageSize.height}`,
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt="Reference for selected-area editing"
          onLoad={(event) => initializeCanvas(event.currentTarget)}
        />
        <canvas
          ref={canvasRef}
          aria-label="Selected image area"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <div className="image-mask-toolbar">
        <div className="image-mask-tool-switch" role="group" aria-label="Mask tool">
          <button
            type="button"
            className={tool === "paint" ? "is-active" : ""}
            aria-pressed={tool === "paint"}
            onClick={() => setTool("paint")}
          >
            Paint
          </button>
          <button
            type="button"
            className={tool === "erase" ? "is-active" : ""}
            aria-pressed={tool === "erase"}
            onClick={() => setTool("erase")}
          >
            Erase
          </button>
        </div>
        <label className="image-mask-brush">
          <span>Brush</span>
          <input
            type="range"
            min={12}
            max={140}
            step={4}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
        </label>
        <button type="button" className="generator-mini-button" onClick={clearMask}>
          Clear
        </button>
      </div>
    </div>
  );
};
