import StorefrontLayout from "@/components/StorefrontLayout";
import { FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type LegalKind = "privacy" | "terms";

const privacySections = [
  ["ព័ត៌មានដែលយើងប្រើ", "ZURS STORE ប្រើព័ត៌មានគណនី ព័ត៌មានកម្មង់ និងព័ត៌មានផ្ទៀងផ្ទាត់ដែលចាំបាច់ ដើម្បីផ្តល់សេវា ការពារការបោកប្រាស់ និងឆ្លើយតបសំណើជំនួយ។"],
  ["ការការពារព័ត៌មាន", "ឯកសារផ្ទៀងផ្ទាត់ និងរូបភាពឯកជនត្រូវបានដាក់កម្រិតសិទ្ធិ។ មានតែ administrator ដែលបានអនុញ្ញាត និងមានហេតុផលករណីច្បាស់លាស់ប៉ុណ្ណោះ ដែលអាចចូលមើលបាន។"],
  ["ការបង្ហាញជាសាធារណៈ", "ព័ត៌មានលម្អិត និងរូបភាពគណនី បង្ហាញតែពេលអ្នកប្រើចុចមើលការផ្សាយ។ យើងបង្ហាញតែខ្លឹមសារដែលម្ចាស់ការផ្សាយបានអនុញ្ញាតឲ្យបង្ហាញ។"],
  ["សិទ្ធិរបស់អ្នក", "អ្នកអាចស្នើសុំកែប្រែ ឬលុបព័ត៌មានមិនចាំបាច់ តាមរយៈផ្នែកគាំទ្រ។ សំណើអំពីព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នកដទៃ ត្រូវតែឆ្លងកាត់ដំណើរការផ្លូវច្បាប់ និងការត្រួតពិនិត្យរបស់ administrator។"],
] as const;

const termsSections = [
  ["ការប្រើប្រាស់សេវា", "អ្នកត្រូវផ្តល់ព័ត៌មានត្រឹមត្រូវ និងប្រើប្រាស់ ZURS STORE តាមច្បាប់ដែលអនុវត្ត។ កុំប្រើសេវាសម្រាប់ការបោកប្រាស់ ការលក់គណនីមិនមែនជារបស់ខ្លួន ឬសកម្មភាពប៉ះពាល់អ្នកដទៃ។"],
  ["Top-up និងការទូទាត់", "កញ្ចប់ និងព័ត៌មានតម្រូវការត្រូវបង្ហាញតាមអ្នកផ្តល់សេវាផ្លូវការ។ ការទូទាត់មិនត្រូវចាត់ទុកថាជោគជ័យ រហូតដល់ប្រព័ន្ធបញ្ជាក់ស្ថានភាពត្រឹមត្រូវ។"],
  ["Marketplace", "ការផ្សាយអាចត្រូវពិនិត្យ មុនបង្ហាញជាសាធារណៈ។ ZURS STORE អាចផ្អាក ឬលុប listing ដែលបំពានលក្ខខណ្ឌ ឬមានសញ្ញាហានិភ័យ។ អ្នកលក់ត្រូវគោរពការបញ្ជាក់អត្តសញ្ញាណ និងលក្ខខណ្ឌទីតាំងកម្ពុជា។"],
  ["ដែនកំណត់", "សកម្មភាពរវាងអ្នកទិញ និងអ្នកលក់ត្រូវធ្វើដោយការប្រុងប្រយ័ត្ន។ ប្រសិនបើមានបញ្ហា សូមប្រើ fraud-report flow ក្នុងវេបសាយ ដើម្បីឲ្យ administrator ពិនិត្យជាមុន។"],
] as const;

export default function Legal({ kind }: { kind: LegalKind }) {
  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "គោលការណ៍ឯកជនភាព" : "លក្ខខណ្ឌប្រើប្រាស់";
  const intro = isPrivacy ? "របៀបដែល ZURS STORE គោរព ការពារ និងប្រើព័ត៌មានរបស់អ្នកដោយតិចបំផុតតាមដែលចាំបាច់។" : "សូមអានលក្ខខណ្ឌសំខាន់ៗ មុនប្រើប្រាស់សេវា Top-up, SMM និង Marketplace។";
  const sections = isPrivacy ? privacySections : termsSections;
  return <StorefrontLayout><main className="container max-w-3xl py-8 sm:py-12"><Link href="/" className="text-xs font-bold text-indigo-700">← ត្រឡប់ទៅទំព័រដើម</Link><header className="mt-4 rounded-2xl bg-slate-950 p-5 text-white sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">{isPrivacy ? <ShieldCheck className="h-5 w-5 text-emerald-200" /> : <FileText className="h-5 w-5 text-indigo-200" />}</div><div><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-200">ZURS STORE</p><h1 className="mt-1 font-display text-2xl font-bold">{title}</h1></div></div><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{intro}</p></header><section className="mt-5 space-y-3">{sections.map(([heading, copy], index) => <article key={heading} className="surface rounded-2xl p-4 sm:p-5"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">{index + 1}</span><div><h2 className="text-sm font-bold text-slate-900">{heading}</h2><p className="mt-2 text-xs leading-6 text-slate-600">{copy}</p></div></div></article>)}</section><p className="mt-6 text-center text-[11px] text-slate-500">អាប់ដេតចុងក្រោយ៖ 21 សីហា 2026</p></main></StorefrontLayout>;
}
