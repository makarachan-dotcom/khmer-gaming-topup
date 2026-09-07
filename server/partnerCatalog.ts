import {createHash} from "node:crypto";
import type {PartnerProduct,PartnerQuote} from "../shared/partnerService";
import { resolvePartnerCopy } from "./partnerCopy";
import { getPartnerOverride, listPartnerOverrides, type PartnerServiceOverride } from "./partnerOverrides";
export const PARTNER_API_BASE="https://ggsoma.store/api/partner/v1";
export class PartnerServiceError extends Error{constructor(public code:string,message:string){super(message);}}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const integer=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0?v:0;
export function moneyCents(v:unknown){if(typeof v!=="string"||!/^\d{1,8}(?:\.\d{1,2})?$/.test(v))throw new PartnerServiceError("INVALID_CATALOG","តម្លៃសេវាមិនត្រឹមត្រួវ។");const [a,b=""]=v.split(".");const n=Number(a)*100+Number(b.padEnd(2,"0"));if(!Number.isSafeInteger(n)||n<1||n>100000000)throw new PartnerServiceError("INVALID_CATALOG","តម្លៃសេវាមិនត្រឹមត្រួវ។");return n;}
export function markupBasisPoints(v=process.env.GGSOMA_SERVICE_MARKUP_PERCENT??"0"){if(!/^\d{1,4}(?:\.\d{1,2})?$/.test(v)||Number(v)>1000)throw new PartnerServiceError("CONFIGURATION","ការកំណត់តម្លៃមិនត្រឹមត្រួវ។");return Math.round(Number(v)*100);}
const retail=(v:unknown,b:number)=>(Math.ceil(moneyCents(v)*(10000+b)/10000)/100).toFixed(2);
export function providerPlainText(v:unknown){return text(v,20000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,s=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "})[s]??s).trim().slice(0,6000);}
export function normalizePartnerProduct(v:unknown,b=markupBasisPoints()):PartnerProduct{const p=record(v),provider=record(p.provider),stock=record(p.stock),w=record(p.warranty),bulk=record(p.bulkDiscount),slug=text(p.slug,120),name=text(p.name,180),type=p.deliveryType;if(!integer(p.id)||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(slug)||!name||!["LINK","COUPON","READY_ACCOUNT"].includes(String(type))||p.currency!=="USD")throw new PartnerServiceError("INVALID_CATALOG","ព័ត្រមានសេវាមិនអាចផ្ទីងផ្ទាត់បាន។");const tiers:PartnerProduct["bulkTiers"]=[];if(bulk.enabled===true&&Array.isArray(bulk.tiers)){for(const raw of bulk.tiers){const t=record(raw),min=integer(t.minQuantity),max=t.maxQuantity===null?null:integer(t.maxQuantity);if(!min||(max!==null&&max<min))continue;try{tiers.push({minQuantity:min,maxQuantity:max,unitPriceUsd:retail(t.unitPrice,b)});}catch{/* skip a broken tier, keep the rest of the catalog */}}}
const count=integer(stock.count),maxQuantity=Math.min(50,count,integer(stock.maxQuantity));return {id:integer(p.id),slug,productCode:text(p.productCode,80),name,provider:{id:integer(provider.id),key:text(provider.key,80),name:text(provider.name,120)||"Digital services"},emoji:text(record(p.emoji).normal,24).match(/\p{Extended_Pictographic}(?:\ufe0f|\u200d\p{Extended_Pictographic})*/u)?.[0]??"✨",deliveryType:type as PartnerProduct["deliveryType"],currency:"USD",priceUsd:retail(p.yourPrice??record(p.pricing).yourUnitPrice,b),durationDays:p.durationDays===null||p.durationDays===undefined?null:integer(p.durationDays),warranty:{enabled:w.enabled===true,days:w.enabled===true?integer(w.days):0},stock:{inStock:stock.inStock===true&&maxQuantity>0,count,maxQuantity},bulkTiers:tiers,description:providerPlainText(p.description),instructions:providerPlainText(p.instructions),updatedAt:text(p.updatedAt,40)||null};}
export function buildPartnerQuote(product:PartnerProduct,quantity:number):PartnerQuote{if(!Number.isInteger(quantity)||quantity<1||quantity>50)throw new PartnerServiceError("INVALID_QUANTITY","សូមេជ្រើសចំនវនត្រឹមត្រួវ។");if(!product.stock.inStock||quantity>product.stock.maxQuantity)throw new PartnerServiceError("OUT_OF_STOCK","Stock មិនគ្រឹបគ្រាន។");const cents=Math.min(moneyCents(product.priceUsd),...product.bulkTiers.filter(t=>quantity>=t.minQuantity&&(t.maxQuantity===null||quantity<=t.maxQuantity)).map(t=>moneyCents(t.unitPriceUsd))),total=cents*quantity;if(!Number.isSafeInteger(total)||total>100000000)throw new PartnerServiceError("INVALID_QUANTITY","ចំនវនទឹកប្រាកលើសកម្រិត។");const unitPriceUsd=(cents/100).toFixed(2),totalUsd=(total/100).toFixed(2),quoteVersion=createHash("sha256").update(JSON.stringify([product.id,product.slug,quantity,unitPriceUsd,totalUsd,product.currency,product.deliveryType,product.durationDays,product.warranty,product.description,product.instructions])).digest("hex");return {product,quantity,unitPriceUsd,totalUsd,quoteVersion};}
const cache=new Map<string,{expires:number;value:unknown}>(),pending=new Map<string,Promise<unknown>>();let credential="";export function resetPartnerCache(){cache.clear();pending.clear();credential="";}
async function partnerGet(path:string,fresh=false):Promise<unknown>{const key=process.env.GGSOMA_PARTNER_API_KEY?.trim();if(!key)throw new PartnerServiceError("NOT_CONFIGURED","សេវាឌីជីដាលកំពុងរីបចំ។ សូមព្យាយាម្ដងទ័តឹងឦប់។");const fingerprint=createHash("sha256").update(key).digest("hex");if(fingerprint!==credential){resetPartnerCache();credential=fingerprint;}const saved=cache.get(path);if(!fresh&&saved&&saved.expires>Date.now())return saved.value;const id=fingerprint+path+fresh,running=pending.get(id);if(running)return running;
const request=(async()=>{let r:Response;try{r=await fetch(PARTNER_API_BASE+path,{method:"GET",headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(10000)});}catch{throw new PartnerServiceError("UNAVAILABLE","មិនអាចភ្ជាប់សេវាបាននៅពេលនេះ។");}let raw:unknown;try{if(Number(r.headers.get("content-length")??0)>2000000)throw new Error();const reader=r.body?.getReader();if(!reader)throw new Error();let length=0;const chunks:Uint8Array[]=[];try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>2000000){await reader.cancel();throw new Error();}chunks.push(part.value);}}finally{reader.releaseLock();}raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new PartnerServiceError("INVALID_RESPONSE","ព័ត្រមានសេវាមិនទាន់អាចបង្ហាយបាន។");}if(!r.ok||record(raw).ok===false){const code=r.status===429?"RATE_LIMIT_EXCEEDED":r.status===404?"PRODUCT_NOT_FOUND":"UNAVAILABLE";throw new PartnerServiceError(code,code==="RATE_LIMIT_EXCEEDED"?"សូមរង់ចាំមួយនាទី មុនសាកម្ដងទ័តឹង។":"សេវាមិនទាន់អាចប្រើបាន។ សូមទាកតុ Admin។");}if(credential===fingerprint){if(cache.size>=120)cache.delete(cache.keys().next().value!);cache.set(path,{expires:Date.now()+60000,value:raw});}return raw;})().finally(()=>pending.delete(id));pending.set(id,request);return request;}
export function applyPartnerPriceOverride(product:PartnerProduct,override?:PartnerServiceOverride|null):PartnerProduct{
  if(!override)return product;
  let next=product;
  if(override.priceUsd){try{moneyCents(override.priceUsd);next={...next,priceUsd:override.priceUsd};}catch{/* keep API retail if the override is malformed */}}
  if(override.nameEn?.trim())next={...next,name:override.nameEn.trim().slice(0,180)};
  return next;
}
export async function getPartnerCatalog(){const raw=record(await partnerGet("/catalog/products"));if(!Array.isArray(raw.data))throw new PartnerServiceError("INVALID_RESPONSE","Catalog មិនត្រឹមត្រួវ។");const b=markupBasisPoints();const overrides=await listPartnerOverrides();const products=[];for(const item of raw.data){try{const product=normalizePartnerProduct(item,b);const override=overrides.get(product.slug);if(override?.hidden)continue;products.push(applyPartnerPriceOverride(product,override));}catch{/* one bad SKU must not hide the rest of the shelf */}}return products;}
export async function getAdminPartnerCatalog(){const raw=record(await partnerGet("/catalog/products"));if(!Array.isArray(raw.data))throw new PartnerServiceError("INVALID_RESPONSE","Catalog មិនត្រឹមត្រួវ។");const b=markupBasisPoints();const overrides=await listPartnerOverrides();const products=[];for(const item of raw.data){try{const product=normalizePartnerProduct(item,b);products.push({product,override:overrides.get(product.slug)??null});}catch{/* keep the rest of the admin shelf */}}return products;}
export async function getPartnerProduct(slug:string,fresh=false){if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(slug))throw new PartnerServiceError("PRODUCT_NOT_FOUND","មិនរកឮញសេវា។");const raw=record(await partnerGet("/catalog/products/"+encodeURIComponent(slug),fresh)),p=normalizePartnerProduct(raw.data??raw);if(p.slug!==slug)throw new PartnerServiceError("INVALID_RESPONSE","ព័ត្រមានមិនត្រួវនឹងសេវាដែលបានែជ្រើស។");const override=await getPartnerOverride(slug);if(override?.hidden)throw new PartnerServiceError("PRODUCT_NOT_FOUND","មិនរកឮញសេវា។");return applyPartnerPriceOverride(p,override);}
export async function getPartnerUsage(){const r=record(await partnerGet("/usage"));if(r.currency!=="USD")throw new PartnerServiceError("INVALID_RESPONSE","Unsupported currency.");return {balance:text(r.balance,24),currency:"USD" as const,apiOrdersTotal:integer(r.apiOrdersTotal),apiOrders24h:integer(r.apiOrders24h),apiSpendTotal:text(r.apiSpendTotal,24),apiSpend24h:text(r.apiSpend24h,24),requestCountToday:integer(r.requestCountToday),errorCountToday:integer(r.errorCountToday)};}

/** Public storefront card — never exposes supplier cost, balance, or raw HTML. */
export function toPublicPartnerProduct(product:PartnerProduct,override?:PartnerServiceOverride|null){
  const copy=resolvePartnerCopy(product,override);
  return {
    id: product.id,
    slug: product.slug,
    name: copy.nameEn,
    nameKh: copy.nameKh,
    providerName: product.provider.name,
    deliveryType: product.deliveryType,
    priceUsd: product.priceUsd,
    currency: product.currency,
    durationDays: product.durationDays,
    warrantyDays: product.warranty.enabled ? product.warranty.days : null,
    inStock: product.stock.inStock,
    stockCount: product.stock.inStock ? product.stock.count : 0,
    maxQuantity: product.stock.maxQuantity,
    emoji: product.emoji,
    description: copy.descriptionKh,
    descriptionKh: copy.descriptionKh,
    descriptionEn: copy.descriptionEn,
    instructions: copy.instructionsKh,
    instructionsKh: copy.instructionsKh,
    instructionsEn: copy.instructionsEn,
    etaMinutes: { min: 5, max: 10 },
    fulfillment: "admin_manual" as const,
  };
}

export function toPublicPartnerPreview(product:PartnerProduct,quantity=1,override?:PartnerServiceOverride|null){
  const quote=buildPartnerQuote(product,quantity);
  return {
    ...toPublicPartnerProduct(product,override),
    quantity: quote.quantity,
    unitPriceUsd: quote.unitPriceUsd,
    totalUsd: quote.totalUsd,
    quoteVersion: quote.quoteVersion,
    noteKh: "សេវានេះត្រូវការ ៥ ទៅ ១០ នាទី បន្ទាប់ពីការទូទាត់។ Admin នឹងបំពេញការកម្មង់នៅផ្ទាំងគ្រប់គ្រង។",
  };
}
