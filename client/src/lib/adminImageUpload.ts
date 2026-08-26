export type AdminImageSlot = "square" | "card";

export type PreparedAdminImage = {
  dataUrl: string;
  fileName: string;
  contentType: "image/webp";
  width: number;
  height: number;
  warning: string | null;
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function targetFor(slot: AdminImageSlot) {
  return slot === "square" ? { width: 512, height: 512 } : { width: 1600, height: 1000 };
}

function dataUrlFor(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read optimized image"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to open this image")); };
    image.src = url;
  });
}

export async function prepareAdminImage(file: File, slot: AdminImageSlot): Promise<PreparedAdminImage> {
  if (!acceptedTypes.has(file.type)) throw new Error("សូមជ្រើស JPG, PNG ឬ WEBP ប៉ុណ្ណោះ");
  if (file.size > 12 * 1024 * 1024) throw new Error("រូបភាពធំពេក។ សូមប្រើរូបភាពក្រោម 12 MB");
  const image = await loadImage(file);
  const target = targetFor(slot);
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = target.width / target.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceAspect > targetAspect) {
    sourceWidth = Math.round(image.naturalHeight * targetAspect);
    sourceX = Math.round((image.naturalWidth - sourceWidth) / 2);
  } else if (sourceAspect < targetAspect) {
    sourceHeight = Math.round(image.naturalWidth / targetAspect);
    sourceY = Math.round((image.naturalHeight - sourceHeight) / 2);
  }
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser cannot prepare this image");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Unable to optimize this image");
  const warning = image.naturalWidth < target.width || image.naturalHeight < target.height
    ? `រូបភាពដើម ${image.naturalWidth}×${image.naturalHeight} តូចជាងទំហំផ្តល់អនុសាសន៍ ${target.width}×${target.height}`
    : null;
  return { dataUrl: await dataUrlFor(blob), fileName: `${file.name.replace(/\.[^.]+$/, "")}-${slot}.webp`, contentType: "image/webp", width: target.width, height: target.height, warning };
}
