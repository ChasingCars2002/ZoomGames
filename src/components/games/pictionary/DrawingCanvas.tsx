import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { useTransportContext } from '../../../context/TransportContext';
import { StrokeData, GameMessage } from '../../../types';

// ---------------------------------------------------------------------------
// DrawingCanvas – HTML5 Canvas with mouse & touch drawing support
// ---------------------------------------------------------------------------

export interface DrawingCanvasHandle {
  clear: () => void;
  undo: () => void;
}

interface DrawingCanvasProps {
  /** Whether this player is the drawer (interactive) or guesser (read-only) */
  isDrawer: boolean;
  /** Current brush color (hex) */
  color?: string;
  /** Current brush size in virtual pixels */
  brushSize?: number;
  /** Whether eraser is active */
  isEraser?: boolean;
  /** Optional width (defaults to container width) */
  width?: number;
  /** Optional height (defaults to container height) */
  height?: number;
}

// Render a single stroke onto a canvas context
function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeData,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Detect eraser strokes (white color used for eraser)
  if (stroke.color === '#ffffff' || stroke.color === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }

  // Scale the brush size relative to canvas width (base 800px)
  ctx.lineWidth = stroke.size * (canvasWidth / 800);

  ctx.beginPath();

  if (stroke.points.length === 1) {
    // Single point: draw a dot
    const x = stroke.points[0].x * canvasWidth;
    const y = stroke.points[0].y * canvasHeight;
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Multiple points: draw path
    const firstX = stroke.points[0].x * canvasWidth;
    const firstY = stroke.points[0].y * canvasHeight;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < stroke.points.length; i++) {
      const x = stroke.points[i].x * canvasWidth;
      const y = stroke.points[i].y * canvasHeight;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// Full canvas redraw from strokes array
function redrawCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: StrokeData[],
  canvasWidth: number,
  canvasHeight: number,
) {
  // Clear to white
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw subtle grid
  drawGrid(ctx, canvasWidth, canvasHeight);

  // Render all strokes
  for (const stroke of strokes) {
    renderStroke(ctx, stroke, canvasWidth, canvasHeight);
  }
}

// Draw subtle grid lines on the canvas
function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.15)';
  ctx.lineWidth = 1;

  const gridSize = canvasWidth / 20; // ~20 cells across

  for (let x = gridSize; x < canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(Math.floor(x) + 0.5, 0);
    ctx.lineTo(Math.floor(x) + 0.5, canvasHeight);
    ctx.stroke();
  }

  for (let y = gridSize; y < canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(y) + 0.5);
    ctx.lineTo(canvasWidth, Math.floor(y) + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  (
    {
      isDrawer,
      color = '#000000',
      brushSize = 8,
      isEraser = false,
      width,
      height,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { transport } = useTransportContext();

    // State
    const strokesRef = useRef<StrokeData[]>([]);
    const currentStrokeRef = useRef<StrokeData | null>(null);
    const isDrawingRef = useRef(false);
    const animFrameRef = useRef<number>(0);

    // Keep current tool settings in refs for use in event handlers
    const colorRef = useRef(color);
    colorRef.current = color;
    const brushSizeRef = useRef(brushSize);
    brushSizeRef.current = brushSize;
    const isEraserRef = useRef(isEraser);
    isEraserRef.current = isEraser;

    const [canvasSize, setCanvasSize] = useState({ w: width ?? 800, h: height ?? 600 });

    // -----------------------------------------------------------------------
    // Resize observer
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (width && height) {
        setCanvasSize({ w: width, h: height });
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) {
          setCanvasSize({ w: Math.floor(cw), h: Math.floor(ch) });
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [width, height]);

    // -----------------------------------------------------------------------
    // Redraw when canvas size changes
    // -----------------------------------------------------------------------
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvasSize.w;
      canvas.height = canvasSize.h;

      redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
    }, [canvasSize]);

    // -----------------------------------------------------------------------
    // Clear & Undo exposed via imperative handle
    // -----------------------------------------------------------------------
    const clearCanvas = useCallback(() => {
      strokesRef.current = [];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      redrawCanvas(ctx, [], canvasSize.w, canvasSize.h);

      // Broadcast clear
      transport?.send({ type: 'DRAW_CLEAR', payload: {} });
    }, [canvasSize, transport]);

    const undoStroke = useCallback(() => {
      if (strokesRef.current.length === 0) return;

      strokesRef.current = strokesRef.current.slice(0, -1);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);

      // Broadcast undo
      transport?.send({ type: 'DRAW_UNDO', payload: {} });
    }, [canvasSize, transport]);

    useImperativeHandle(
      ref,
      () => ({
        clear: clearCanvas,
        undo: undoStroke,
      }),
      [clearCanvas, undoStroke],
    );

    // -----------------------------------------------------------------------
    // Convert pointer position to normalized coordinates (0-1)
    // -----------------------------------------------------------------------
    const getCanvasPoint = useCallback(
      (clientX: number, clientY: number): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        return {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
        };
      },
      [],
    );

    // -----------------------------------------------------------------------
    // Drawing event handlers (drawer only)
    // -----------------------------------------------------------------------
    const startStroke = useCallback(
      (clientX: number, clientY: number) => {
        if (!isDrawer) return;

        isDrawingRef.current = true;
        const point = getCanvasPoint(clientX, clientY);
        const strokeColor = isEraserRef.current ? 'eraser' : colorRef.current;

        currentStrokeRef.current = {
          points: [point],
          color: strokeColor,
          size: brushSizeRef.current,
        };

        // Start animation loop for smooth rendering
        const renderLoop = () => {
          const canvas = canvasRef.current;
          const stroke = currentStrokeRef.current;
          if (!canvas || !stroke) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Redraw everything plus current stroke
          redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
          renderStroke(ctx, stroke, canvasSize.w, canvasSize.h);

          if (isDrawingRef.current) {
            animFrameRef.current = requestAnimationFrame(renderLoop);
          }
        };

        animFrameRef.current = requestAnimationFrame(renderLoop);
      },
      [isDrawer, getCanvasPoint, canvasSize],
    );

    const moveStroke = useCallback(
      (clientX: number, clientY: number) => {
        if (!isDrawer || !isDrawingRef.current || !currentStrokeRef.current) return;

        const point = getCanvasPoint(clientX, clientY);
        currentStrokeRef.current.points.push(point);
      },
      [isDrawer, getCanvasPoint],
    );

    const endStroke = useCallback(() => {
      if (!isDrawer || !isDrawingRef.current) return;

      isDrawingRef.current = false;
      cancelAnimationFrame(animFrameRef.current);

      const stroke = currentStrokeRef.current;
      if (stroke && stroke.points.length > 0) {
        strokesRef.current = [...strokesRef.current, stroke];

        // Final render
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
          }
        }

        // Broadcast stroke
        transport?.send({
          type: 'DRAW_STROKE',
          payload: { stroke },
        });
      }

      currentStrokeRef.current = null;
    }, [isDrawer, canvasSize, transport]);

    // -----------------------------------------------------------------------
    // Mouse event handlers
    // -----------------------------------------------------------------------
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        startStroke(e.clientX, e.clientY);
      },
      [startStroke],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        moveStroke(e.clientX, e.clientY);
      },
      [moveStroke],
    );

    const handleMouseUp = useCallback(() => {
      endStroke();
    }, [endStroke]);

    const handleMouseLeave = useCallback(() => {
      if (isDrawingRef.current) {
        endStroke();
      }
    }, [endStroke]);

    // -----------------------------------------------------------------------
    // Touch event handlers
    // -----------------------------------------------------------------------
    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
          startStroke(touch.clientX, touch.clientY);
        }
      },
      [startStroke],
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
          moveStroke(touch.clientX, touch.clientY);
        }
      },
      [moveStroke],
    );

    const handleTouchEnd = useCallback(
      (e: React.TouchEvent) => {
        e.preventDefault();
        endStroke();
      },
      [endStroke],
    );

    // -----------------------------------------------------------------------
    // Transport subscription (for receiving strokes from the drawer)
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!transport) return;

      const unsubscribe = transport.subscribe(
        (message: GameMessage, _senderId: string) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          switch (message.type) {
            case 'DRAW_STROKE': {
              const { stroke } = message.payload;
              strokesRef.current = [...strokesRef.current, stroke];
              redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
              break;
            }

            case 'DRAW_CLEAR': {
              strokesRef.current = [];
              redrawCanvas(ctx, [], canvasSize.w, canvasSize.h);
              break;
            }

            case 'DRAW_UNDO': {
              if (strokesRef.current.length > 0) {
                strokesRef.current = strokesRef.current.slice(0, -1);
                redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
              }
              break;
            }

            default:
              break;
          }
        },
      );

      return unsubscribe;
    }, [transport, canvasSize]);

    // -----------------------------------------------------------------------
    // Initial canvas draw
    // -----------------------------------------------------------------------
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvasSize.w;
      canvas.height = canvasSize.h;
      redrawCanvas(ctx, strokesRef.current, canvasSize.w, canvasSize.h);
    }, [canvasSize]);

    // -----------------------------------------------------------------------
    // Cleanup animation frame on unmount
    // -----------------------------------------------------------------------
    useEffect(() => {
      return () => {
        cancelAnimationFrame(animFrameRef.current);
      };
    }, []);

    // -----------------------------------------------------------------------
    // Determine cursor style
    // -----------------------------------------------------------------------
    const cursorStyle = isDrawer
      ? isEraser
        ? 'cursor-cell'
        : 'cursor-crosshair'
      : 'cursor-default';

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden border-2 border-white/10 bg-white shadow-lg"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className={[
            'absolute inset-0 w-full h-full touch-none',
            cursorStyle,
          ].join(' ')}
          style={{ imageRendering: 'auto' }}
          // Mouse events
          onMouseDown={isDrawer ? handleMouseDown : undefined}
          onMouseMove={isDrawer ? handleMouseMove : undefined}
          onMouseUp={isDrawer ? handleMouseUp : undefined}
          onMouseLeave={isDrawer ? handleMouseLeave : undefined}
          // Touch events
          onTouchStart={isDrawer ? handleTouchStart : undefined}
          onTouchMove={isDrawer ? handleTouchMove : undefined}
          onTouchEnd={isDrawer ? handleTouchEnd : undefined}
        />

        {/* Overlay for non-drawers: subtle indicator */}
        {!isDrawer && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-navy-900/60 backdrop-blur-sm rounded-md">
            <span className="font-body text-xs text-white/50">Watching</span>
          </div>
        )}
      </div>
    );
  },
);

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
