export const SERVICE_ETA_KH="សេវានេះត្រូវការប្រហែល 5–10 នាទី បន្ទាប់ពីការទូទាត់បានបញ្ជាក់។ Admin នឹងបំពេញការបញ្ជាទិញដោយដៃ។";
export type DeliveryType="LINK"|"COUPON"|"READY_ACCOUNT";
export type ServiceState="queued"|"processing"|"needs_attention"|"delivered"|"refunded";
export type PartnerProduct={id:number;slug:string;productCode:string;name:string;provider:{id:number;key:string;name:string};emoji:string;deliveryType:DeliveryType;currency:"USD";priceUsd:string;durationDays:number|null;warranty:{enabled:boolean;days:number};stock:{inStock:boolean;count:number;maxQuantity:number};bulkTiers:{minQuantity:number;maxQuantity:number|null;unitPriceUsd:string}[];description:string;instructions:string;updatedAt:string|null};
export type PartnerQuote={product:PartnerProduct;quantity:number;unitPriceUsd:string;totalUsd:string;quoteVersion:string};
export type ServiceDelivery={type:DeliveryType;items:string[];instructions:string};
export const deliveryTypeLabels:Record<DeliveryType,string>={LINK:"Activation link",COUPON:"Coupon code",READY_ACCOUNT:"Ready account"};
export const fulfillmentLabels:Record<ServiceState,string>={queued:"រង់ចាំ Admin",processing:"កំពុងបំពេញ",needs_attention:"កំពុងពិនិត្យបន្ថែម",delivered:"បានបញ្ចប់",refunded:"បានសងប្រាក់"};
