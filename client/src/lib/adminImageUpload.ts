export type AdminImageSlot = "square" | "card";
type PreparedRasterContentType = "image/webp" | "image/jpeg";

export type PreparedAdminImage = {
  dataUrl: string;
  fileName: string;
  contentType: PreparedRasterContentType;
  width: number;
  height: number;
  warning: string | null;
};

export type PreparedPaymentMethodIcon = Omit<PreparedAdminImage, "contentType"> & {
  contentType: PreparedRasterContentType | "image/svg+xml";
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const paymentIconTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const maxSourceBytes = 12 * 1024 * 1024;
const maxPreparedBytes = 4_500_000;
const paymentIconMaxBytes = 2 * 1024 * 1024;

function targetFor(slot: AdminImageSlot) {
  return slot === "square" ? { width: 512, height: 512 } : { width: 1600, height: 1000 };
}

function dataUrlFor(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("មិនអាចអានរូបភាពដែលបានរៀបចំបានទេ"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("មិនអាចបើករូបភាពនេះបានទេ។ សូមប្រើ JPG, PNG ឬ WEBP ដែលមិនខូច")); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, contentType: PreparedRasterContentType, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, contentType, quality));
}

async function encodePreparedImage(canvas: HTMLCanvasElement) {
  for (const contentType of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await canvasBlob(canvas, contentType, quality);
      if (blob && blob.size > 0 && blob.size <= maxPreparedBytes) return { blob, contentType };
    }
  }
  throw new Error("មិនអាចបង្រួមរូបភាពឲ្យសមស្របសម្រាប់ upload បានទេ។ សូមប្រើរូបភាពដែលមានទំហំតូចជាងនេះ");
}

export async function preparePaymentMethodIcon(file: File): Promise<PreparedPaymentMethodIcon> {
  if (!paymentIconTypes.has(file.type)) throw new Error("សូមជ្រើស JPG, PNG, WEBP ឬ SVG ប៉ុណ្ណោះ");
  if (file.size > paymentIconMaxBytes) throw new Error("payment icon ត្រូវមានទំហំក្រោម 2 MB");
  if (file.type === "image/svg+xml") {
    const svg = await file.text();
    if (!/^\s*<svg[\s>]/i.test(svg) || /<\s*(?:script|foreignObject)\b|\bon\w+\s*=|javascript\s*:/i.test(svg)) throw new Error("SVG នេះមិនមានសុវត្ថិភាពសម្រាប់ upload ទេ");
    return { dataUrl: await dataUrlFor(file), fileName: file.name.replace(/\.[^.]+$/, "") + "-payment-icon.svg", contentType: "image/svg+xml", width: 0, height: 0, warning: null };
  }
  return prepareAdminImage(file, "square");
}

export async function prepareAdminImage(file: File, slot: AdminImageSlot): Promise<PreparedAdminImage> {
  if (!acceptedTypes.has(file.type)) throw new Error("សូមជ្រើស JPG, PNG ឬ WEBP ប៉ុណ្ណោះ");
  if (file.size > maxSourceBytes) throw new Error("រូបភាពធំពេក។ សូមប្រើរូបភាពក្រោម 12 MB");
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("រូបភាពនេះគ្មានទំហំត្រឹមត្រូវសម្រាប់ upload ទេ");
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
  if (!context) throw new Error("browser របស់អ្នកមិនអាចរៀបចំរូបភាពនេះបានទេ");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
  const encoded = await encodePreparedImage(canvas);
  const warning = image.naturalWidth < target.width || image.naturalHeight < target.height
    ? `រូបភាពដើម ${image.naturalWidth}×${image.naturalHeight} តូចជាងទំហំផ្តល់អនុសាសន៍ ${target.width}×${target.height}`
    : null;
  const extension = encoded.contentType === "image/jpeg" ? "jpg" : "webp";
  return { dataUrl: await dataUrlFor(encoded.blob), fileName: `${file.name.replace(/\.[^.]+$/, "")}-${slot}.${extension}`, contentType: encoded.contentType, width: target.width, height: target.height, warning };
}
