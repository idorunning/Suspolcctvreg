import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Trash2 } from "lucide-react";
export default function PhotoEditor({
  onChange,
  onError,
}: {
  onChange: (s: string) => void;
  onError: (s: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    original = useRef<ImageBitmap | null>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    backup = useRef<ImageData | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(
    () => () => {
      original.current?.close();
    },
    [],
  );
  const output = () => {
    if (!canvas.current) return;
    const data = canvas.current.toDataURL("image/jpeg", 0.76);
    if (data.length > 466000) {
      onError(
        "The photo is too detailed. Please choose a closer, simpler image.",
      );
      onChange("");
    } else onChange(data);
  };
  const redraw = () => {
    const c = canvas.current;
    if (c && original.current) {
      c.getContext("2d")!.drawImage(original.current, 0, 0, c.width, c.height);
      output();
    }
  };
  return (
    <div className="photo-editor">
      <label className="upload-button">
        <Camera size={20} />
        <span>
          {loaded
            ? "Choose a different photo"
            : "Take or choose a camera photo"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 15 * 1024 * 1024) {
              onError("Choose a photo smaller than 15 MB.");
              return;
            }
            try {
              const image = await createImageBitmap(f);
              original.current?.close();
              original.current = image;
              const scale = Math.min(
                1,
                1200 / Math.max(image.width, image.height),
              );
              const c = canvas.current!;
              c.width = Math.round(image.width * scale);
              c.height = Math.round(image.height * scale);
              setLoaded(true);
              redraw();
            } catch {
              onError(
                "That photo could not be read. Please use JPEG, PNG or WebP.",
              );
            }
          }}
        />
      </label>
      <div hidden={!loaded}>
        <p className="help">
          Drag across anything that needs hiding. Black rectangles are
          permanently applied to the saved copy. Crop the shot closely around
          the camera.
        </p>
        <canvas
          ref={canvas}
          aria-label="Photo redaction editor"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const c = e.currentTarget,
              r = c.getBoundingClientRect();
            start.current = {
              x: ((e.clientX - r.left) * c.width) / r.width,
              y: ((e.clientY - r.top) * c.height) / r.height,
            };
            backup.current = c
              .getContext("2d")!
              .getImageData(0, 0, c.width, c.height);
          }}
          onPointerMove={(e) => {
            if (!start.current || !backup.current) return;
            const c = e.currentTarget,
              r = c.getBoundingClientRect(),
              ctx = c.getContext("2d")!;
            ctx.putImageData(backup.current, 0, 0);
            ctx.fillStyle = "#111";
            ctx.fillRect(
              start.current.x,
              start.current.y,
              ((e.clientX - r.left) * c.width) / r.width - start.current.x,
              ((e.clientY - r.top) * c.height) / r.height - start.current.y,
            );
          }}
          onPointerUp={() => {
            start.current = null;
            backup.current = null;
            output();
          }}
          onPointerCancel={() => {
            start.current = null;
            backup.current = null;
            output();
          }}
        />
        <div className="button-row">
          <button type="button" className="text-button" onClick={redraw}>
            <RotateCcw size={16} />
            Reset redactions
          </button>
          <button
            type="button"
            className="text-button danger-text"
            onClick={() => {
              setLoaded(false);
              onChange("");
              original.current?.close();
              original.current = null;
            }}
          >
            <Trash2 size={16} />
            Remove photo
          </button>
        </div>
      </div>
    </div>
  );
}
