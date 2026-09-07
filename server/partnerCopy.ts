import type { DeliveryType, PartnerProduct } from "../shared/partnerService";

type CopyOverride = {
  nameEn?: string;
  nameKh?: string;
  descriptionEn?: string;
  descriptionKh?: string;
  instructionsEn?: string;
  instructionsKh?: string;
};

export function brandAsZurs(value: string) {
  return value
    .replace(/https?:\/\/(?:www\.)?ggsoma\.store[^\s]*/gi, "https://zurs.me")
    .replace(/\bggsoma\.store\b/gi, "zurs.me")
    .replace(/\bggsoma\b/gi, "ZURS.me");
}

const DELIVERY_KH: Record<DeliveryType, string> = {
  LINK: "តំណ Activation",
  COUPON: "លេខកូដ Coupon",
  READY_ACCOUNT: "គណនីរួចរាល់",
  CDK: "កូដ CDK",
};
const DELIVERY_EN: Record<DeliveryType, string> = {
  LINK: "Activation link",
  COUPON: "Coupon code",
  READY_ACCOUNT: "Ready account",
  CDK: "CDK code",
};

export function coerceApiDeliveryType(value: unknown): DeliveryType | null {
  const raw = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (raw === "LINK" || raw === "INVITE" || raw === "INVITE_LINK" || raw === "ACTIVATION_LINK") return "LINK";
  if (raw === "CDK" || raw === "KEY" || raw === "CARD" || raw === "CARD_KEY" || raw === "REDEEM" || raw === "REDEEM_CODE" || raw === "ACTIVATION_CODE") return "CDK";
  if (raw === "COUPON" || raw === "VOUCHER" || raw === "GIFT" || raw === "GIFT_CODE" || raw === "GIFT_CARD") return "COUPON";
  if (raw === "READY_ACCOUNT" || raw === "ACCOUNT" || raw === "LOGIN" || raw === "CREDENTIALS" || raw === "READY") return "READY_ACCOUNT";
  return null;
}

function hintDelivery(text: string, allowPrivate = false): DeliveryType | null {
  if (/\bcdk\b|卡密|card\s*key|activation\s*code|redeem(?:s|ing)?\s*code/i.test(text)) return "CDK";
  if (/\b(?:invite|activation|redeem(?:s|ing)?)\s*links?\b|\binvite\s*url\b|兑换链接/i.test(text)) return "LINK";
  if (/\bready\s*accounts?\b|\bshared\s*(?:acc(?:ount)?s?)\b|成品号|email\s*(?:and|\+|\/)\s*pass(?:word)?|\blogin\s*pass/i.test(text) || (allowPrivate && /\bprivate\b/i.test(text))) return "READY_ACCOUNT";
  if (/\bcoupons?\b|\bvouchers?\b|\bgift\s*(?:codes?|cards?|keys?)\b/i.test(text)) return "COUPON";
  return null;
}

export function resolveDeliveryType(input: {
  apiType?: unknown;
  name?: string;
  productCode?: string;
  description?: string;
  instructions?: string;
}): DeliveryType | null {
  const title = `${input.name ?? ""} ${input.productCode ?? ""}`;
  return hintDelivery(title, true) || hintDelivery(`${input.description ?? ""} ${input.instructions ?? ""}`) || coerceApiDeliveryType(input.apiType);
}

type Blurb = { kh: string; en: string };
const PROVIDER_BLURB: Array<[RegExp, Blurb]> = [
  [/chatgpt|openai|\bgpt\b/i, { kh: "សេវា ChatGPT ផ្លូវការ សម្រាប់ជជែក សរសេរ និងប្រើ AI។", en: "Official ChatGPT access for chat, writing, and AI tools." }],
  [/claude|anthropic/i, { kh: "សេវា Claude ផ្លូវការ សម្រាប់សរសេរ និងវិភាគដោយ AI។", en: "Official Claude access for writing and analysis." }],
  [/gemini/i, { kh: "សេវា Google Gemini ផ្លូវការ សម្រាប់ AI ស្វែងរក និងសរសេរ។", en: "Official Google Gemini access for AI search and writing." }],
  [/cursor/i, { kh: "Cursor សម្រាប់សរសេរកូដជាមួយ AI ក្នុង editor។", en: "Cursor AI coding editor access." }],
  [/canva/i, { kh: "Canva សម្រាប់រចនារូប ស្លាយ និងវីដេអូ ដោយគ្មាន watermark។", en: "Canva design tools without watermarks." }],
  [/capcut|cap cut/i, { kh: "CapCut Pro សម្រាប់កាត់វីដេអូ និង effect ពេញលេញ។", en: "CapCut Pro for full video editing tools." }],
  [/netflix/i, { kh: "Netflix សម្រាប់មើលភាពយន្ត និងស៊េរី។", en: "Netflix streaming access." }],
  [/spotify/i, { kh: "Spotify Premium ស្តាប់ចម្រៀងគ្មានពាណិជ្ជកម្ម។", en: "Spotify Premium, ad-free listening." }],
  [/youtube|ytb/i, { kh: "YouTube Premium មើលវីដេអូគ្មានពាណិជ្ជកម្ម។", en: "YouTube Premium, ad-free videos." }],
  [/prime/i, { kh: "Prime Video សម្រាប់មើលភាពយន្ត និងស៊េរី។", en: "Prime Video streaming access." }],
  [/telegram/i, { kh: "Telegram Premium សម្រាប់ sticker ល្បឿន និង cloud។", en: "Telegram Premium extra features." }],
  [/figma/i, { kh: "Figma សម្រាប់រចនា UI និងធ្វើការជាក្រុម។", en: "Figma for UI design and teamwork." }],
  [/eleven/i, { kh: "ElevenLabs សម្រាប់បង្កើតសំឡេង AI។", en: "ElevenLabs AI voice generation." }],
  [/linkedin/i, { kh: "LinkedIn Premium សម្រាប់ការងារ និង network។", en: "LinkedIn Premium for jobs and networking." }],
  [/ilovepdf|pdf/i, { kh: "iLovePDF សម្រាប់កែ បំប្លែង និងបង្រួម PDF។", en: "iLovePDF tools to edit and convert PDFs." }],
  [/heygen/i, { kh: "HeyGen សម្រាប់បង្កើតវីដេអូ AI avatar។", en: "HeyGen AI avatar videos." }],
  [/quill/i, { kh: "QuillBot សម្រាប់សរសេរឡើងវិញ និងកែវេយ្យាករណ៍។", en: "QuillBot rewriting and grammar tools." }],
  [/manus/i, { kh: "Manus AI សម្រាប់ជំនួយការងារ និងស្រាវជ្រាវ។", en: "Manus AI assistant access." }],
  [/\bvpn\b|nordvpn/i, { kh: "VPN ផ្លូវការ សម្រាប់ភ្ជាប់សុវត្ថិភាព។", en: "Official VPN access." }],
  [/microsoft|office|windows/i, { kh: "Microsoft / Office សេវាផ្លូវការ។", en: "Official Microsoft / Office access." }],
  [/official subscription|subscription/i, { kh: "សេវាជាវផ្លូវការ តាមកញ្ចប់ដែលបានជ្រើស។", en: "Official subscription for the selected plan." }],
];

function clip(value: string, max: number) {
  const text = value.replace(/\r\n/g, "\n").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function hasKhmer(value: string) {
  return /[\u1780-\u17FF]/.test(value);
}

function matchBlurb(product: PartnerProduct): Blurb {
  const hay = `${product.provider.name} ${product.name} ${product.provider.key}`;
  for (const [pattern, blurb] of PROVIDER_BLURB) if (pattern.test(hay)) return blurb;
  return {
    kh: `សេវា ${product.provider.name} ផ្លូវការ។`,
    en: `Official ${product.provider.name} access.`,
  };
}

function factsKh(product: PartnerProduct) {
  const bits = [DELIVERY_KH[product.deliveryType]];
  if (product.durationDays) bits.push(`រយៈពេល ${product.durationDays} ថ្ងៃ`);
  if (product.warranty.enabled && product.warranty.days) bits.push(`Warranty ${product.warranty.days} ថ្ងៃ`);
  bits.push("Admin បំពេញក្នុង ៥–១០ នាទី បន្ទាប់ពីបង់ប្រាក់។");
  return bits.join(" · ");
}

function factsEn(product: PartnerProduct) {
  const bits = [DELIVERY_EN[product.deliveryType]];
  if (product.durationDays) bits.push(`${product.durationDays}-day access`);
  if (product.warranty.enabled && product.warranty.days) bits.push(`${product.warranty.days}-day warranty`);
  bits.push("Admin delivers 5–10 minutes after payment.");
  return bits.join(" · ");
}

function instructionsKh(type: DeliveryType) {
  if (type === "CDK") return "អ្នកនឹងទទួលបានលេខកូដ CDK។ ប្រើកូដតាមការណែនាំដើម្បីបើកសេវាលើគណនីរបស់អ្នក។ កុំចែកកូដឲ្យអ្នកដទៃ។";
  if (type === "COUPON") return "អ្នកនឹងទទួលបានលេខកូដ។ បញ្ចូលកូដក្នុងគេហទំព័រផ្លូវការ។ កូដប្រើបានមួយដង — កុំចែកឲ្យអ្នកដទៃ។";
  if (type === "READY_ACCOUNT") return "អ្នកនឹងទទួលបានគណនីរួចរាល់។ ចូលភ្លាមៗ រួចប្តូរពាក្យសម្ងាត់។ កុំចែក email/password។";
  return "អ្នកនឹងទទួលបានតំណ Activation។ បើកតំណដើម្បីដំណើរការសេវា។ កុំចែកតំណឲ្យអ្នកដទៃ។";
}

function instructionsEn(type: DeliveryType) {
  if (type === "CDK") return "You receive a CDK activation code. Redeem it as instructed on your own account. Do not share the code.";
  if (type === "COUPON") return "You receive a one-time coupon. Redeem it on the official site. Do not share the code.";
  if (type === "READY_ACCOUNT") return "You receive a ready account. Sign in and change the password immediately. Do not share the login.";
  return "You receive an activation link. Open it to start the service. Do not share the link.";
}

export function deliveryLabelKh(type: string) {
  return DELIVERY_KH[type as DeliveryType] ?? type;
}

export function deliveryLabelEn(type: string) {
  return DELIVERY_EN[type as DeliveryType] ?? type;
}

export function resolvePartnerCopy(product: PartnerProduct, override?: CopyOverride | null) {
  const blurb = matchBlurb(product);
  const sourceDesc = product.description.trim();
  const sourceInst = product.instructions.trim();
  const khDesc = override?.descriptionKh?.trim() || (hasKhmer(sourceDesc) ? sourceDesc : [blurb.kh, factsKh(product), sourceDesc].filter(Boolean).join("\n\n"));
  const enDesc = override?.descriptionEn?.trim() || sourceDesc || `${blurb.en} ${factsEn(product)}`;
  const khInst = override?.instructionsKh?.trim() || (hasKhmer(sourceInst) ? sourceInst : [instructionsKh(product.deliveryType), sourceInst].filter(Boolean).join("\n\n"));
  const enInst = override?.instructionsEn?.trim() || sourceInst || instructionsEn(product.deliveryType);
  return {
    nameKh: clip(brandAsZurs(override?.nameKh?.trim() || `${product.provider.name} · ${product.name}`), 180),
    nameEn: clip(brandAsZurs(override?.nameEn?.trim() || product.name), 180),
    descriptionKh: clip(brandAsZurs(khDesc), 6000),
    descriptionEn: clip(brandAsZurs(enDesc), 6000),
    instructionsKh: clip(brandAsZurs(khInst), 6000),
    instructionsEn: clip(brandAsZurs(enInst), 6000),
  };
}
