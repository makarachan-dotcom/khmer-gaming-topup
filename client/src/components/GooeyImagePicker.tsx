import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Liquid } from "liquid-gooey";
import { Camera, ImageIcon, Paperclip, X } from "lucide-react";

/**
 * Gooey attachment button (https://libraries.dev/gooey.html).
 *
 * Per the brief, the Liquid/gooey effect is used for the IMAGE PICKER ONLY —
 * do not spread it across the rest of the chat UI. Closed, the three buttons
 * sit on top of each other and read as one blob; open, the two children melt
 * outward while their icons stay crisp.
 */
export type GooeyImagePickerProps = {
  onPick: (file: File) => void;
  disabled?: boolean;
  busy?: boolean;
};

export default function GooeyImagePicker({ onPick, disabled = false, busy = false }: GooeyImagePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const locked = disabled || busy;

  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      const file = files && files.length > 0 ? files[0] : null;
      // Clear the input so re-picking the same file still fires `change`.
      event.target.value = "";
      setOpen(false);
      if (file) onPick(file);
    },
    [onPick],
  );

  return (
    <div className={`zs-pick${open ? " is-open" : ""}`} ref={rootRef}>
      <input
        ref={galleryRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="zs-pick__input"
        tabIndex={-1}
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="zs-pick__input"
        tabIndex={-1}
        onChange={handleChange}
      />

      <Liquid blur={6} contrast={18} fill="#151b30">
        <Liquid.Item effect="morph" transition="bouncy">
          <button
            type="button"
            className="zs-pick__btn zs-pick__btn--main"
            onClick={() => !locked && setOpen((value) => !value)}
            disabled={locked}
            aria-expanded={open}
            aria-label={open ? "បិទ" : "ផ្ញើរូបភាព"}
          >
            {open ? <X size={18} /> : <Paperclip size={18} />}
          </button>
        </Liquid.Item>

        <Liquid.Item effect="melt" transition="bouncy" x={open ? -4 : 0} y={open ? -58 : 0}>
          <button
            type="button"
            className="zs-pick__btn zs-pick__btn--gallery"
            onClick={() => galleryRef.current?.click()}
            disabled={locked}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            aria-label="ជ្រើសរូបភាពពីទូរស័ព្ទ"
          >
            <ImageIcon size={16} />
          </button>
        </Liquid.Item>

        <Liquid.Item effect="melt" transition="bouncy" delay={0.04} x={open ? -54 : 0} y={open ? -34 : 0}>
          <button
            type="button"
            className="zs-pick__btn zs-pick__btn--camera"
            onClick={() => cameraRef.current?.click()}
            disabled={locked}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            aria-label="ថតរូបភាពថ្មី"
          >
            <Camera size={16} />
          </button>
        </Liquid.Item>
      </Liquid>
    </div>
  );
}
