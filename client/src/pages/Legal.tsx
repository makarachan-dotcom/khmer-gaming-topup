import { Reveal } from "@/components/Reveal";
import StorefrontLayout from "@/components/StorefrontLayout";
import { FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type LegalKind = "privacy" | "terms";

const privacySections = [
  ["ព័ត៌មានដែលយើងប្រើ", "ZURS STORE ប្រើព័ត៌មានគណនី ព័ត៌មានកម្មង់ និងព័ត៌មានផ្ទៀងផ្ទាត់ដែលចាំបាច់ ដើម្បីផ្តល់សេវា ការពារការបោកប្រាស់ និងឆ្លើយតបសំណើជំនួយ។"],
  ["ការការពារព័ត៌មាន", "ឯកសារផ្ទៀងផ្ទាត់ និងរូបភាពឯកជនត្រូវបានដាក់កម្រិតសិទ្ធិ។ មានតែ administrator ដែលបានអនុញ្ញាត និងមានហេតុផលករណីច្បាស់លាស់ប៉ុណ្ណោះ ដែលអាចចូលមើលបាន។"],
  ["Live Spin connection telemetry", "នៅពេលអ្នកយល់ព្រមចូលរួម Live Spin យើងកត់ត្រាតែ connection timestamps ក្នុងគណនីរបស់អ្នក—ពេលចាប់ផ្តើម និង heartbeat ពេលនៅភ្ជាប់—សម្រាប់គណនារយៈពេលតភ្ជាប់។ យើងមិនតាមដានអេក្រង់, camera, microphone, screen recording ឬ device fingerprint ទេ។"],
  ["ការបង្ហាញព័ត៌មាន", "យើងបង្ហាញតែព័ត៌មានដែលចាំបាច់សម្រាប់ការផ្តល់សេវា និងការគាំទ្រ។ លទ្ធផល Live Spin បង្ហាញតែ alias មិនមែន user ID, email ឬ connection timestamps លម្អិតទេ។ ព័ត៌មានឯកជនមិនត្រូវបង្ហាញជាសាធារណៈដោយគ្មានមូលដ្ឋានត្រឹមត្រូវទេ។"],
  ["សិទ្ធិរបស់អ្នក", "អ្នកអាចស្នើសុំកែប្រែ ឬលុបព័ត៌មានមិនចាំបាច់ តាមរយៈផ្នែកគាំទ្រ។ សំណើអំពីព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នកដទៃ ត្រូវតែឆ្លងកាត់ដំណើរការផ្លូវច្បាប់ និងការត្រួតពិនិត្យរបស់ administrator។"],
] as const;

const termsSections = [
  ["ការប្រើប្រាស់សេវា", "អ្នកត្រូវផ្តល់ព័ត៌មានត្រឹមត្រូវ និងប្រើប្រាស់ ZURS STORE តាមច្បាប់ដែលអនុវត្ត។ កុំប្រើសេវាសម្រាប់ការបោកប្រាស់ ឬសកម្មភាពប៉ះពាល់អ្នកដទៃ។"],
  ["Top-up និងការទូទាត់", "កញ្ចប់ និងព័ត៌មានតម្រូវការត្រូវបង្ហាញក្នុង ZURS STORE។ ការទូទាត់មិនត្រូវចាត់ទុកថាជោគជ័យ រហូតដល់ប្រព័ន្ធបញ្ជាក់ស្ថានភាពត្រឹមត្រូវ។"],
  ["ការផ្ទៀងផ្ទាត់លេខ ID", "អ្នកត្រូវបំពេញព័ត៌មានគណនីឱ្យត្រឹមត្រូវ និងពិនិត្យឈ្មោះដែលប្រព័ន្ធបង្ហាញ មុនមើលកញ្ចប់។ សម្រាប់ហ្គេមដែលមិនគាំទ្រការផ្ទៀងផ្ទាត់ឈ្មោះ សូមពិនិត្យលេខ ID ដោយប្រុងប្រយ័ត្ន។"],
  ["ដែនកំណត់", "សូមពិនិត្យព័ត៌មានគណនី និងកញ្ចប់ឲ្យត្រឹមត្រូវមុនបន្ត។ ប្រសិនបើមានបញ្ហា សូមប្រើ Ticket ក្នុងគណនីរបស់អ្នក ដើម្បីឲ្យក្រុមគាំទ្រពិនិត្យ។"],
  ["ZURS Live Spin · Customer Loyalty Giveaway", "Live Spin គឺជាកម្មវិធីរង្វាន់សម្រាប់អតិថិជន ZURS មិនមែនជាសេវាភ្នាល់ ឬការលក់សំបុត្រទេ។ ដើម្បីមានសិទ្ធិ អ្នកត្រូវមានអាយុ 18 ឆ្នាំឡើង និងអនុវត្តតាមលក្ខខណ្ឌផ្សព្វផ្សាយ ការជ្រើសរើសអ្នកឈ្នះ និងច្បាប់ដែលអនុវត្តក្នុងតំបន់របស់អ្នក។"],
  ["Tickets និងការបន្តទៅសប្តាហ៍បន្ទាប់", "ការបញ្ជាទិញដែលបានបង់ប្រាក់រួច មានតម្លៃយ៉ាងហោច $1 និងបំពេញលក្ខខណ្ឌ ចំនួន 7 ដងក្នុង weekly cycle ដូចគ្នា ទទួលបាន 1 ticket។ Live Spin កំណត់ជាថ្ងៃអាទិត្យ ម៉ោង 3:00 រសៀល តាមម៉ោងកម្ពុជា។ ប្រសិនបើមិនទាន់ដល់ 100 អ្នកចូលរួម សប្តាហ៍នោះនឹងត្រូវ skip ដោយស្វ័យប្រវត្តិ ហើយ tickets ដែលនៅមានសិទ្ធិនឹង roll over ទៅ Live Spin សប្តាហ៍បន្ទាប់។ នៅពេល event សម្រេច draw បានជោគជ័យ ticket ដែលបាន lock ចូល draw នោះនឹងត្រូវប្រើសម្រាប់ event នោះ ហើយមិន roll over ទេ។"],
  ["អ្នកឈ្នះ និងកាដូលើកទឹកចិត្ត", "សម្រាប់ event ដែលបានបើក ZURS នឹងជ្រើសអ្នកឈ្នះចំនួន 3 នាក់ជាមួយគ្នា តាម rules ដែលបង្ហាញជាសាធារណៈសម្រាប់សប្តាហ៍នោះ។ កាដូលើកទឹកចិត្តចំនួនរហូតដល់ 10 នាក់ ត្រូវជ្រើសតាមរយៈពេលតភ្ជាប់ជាមួយ Live (connection time) ដែលអ្នកប្រើបានយល់ព្រមឱ្យកត់ត្រាក្នុងគណនី—មិនមែនការមើលអេក្រង់ផ្ទាល់ទេ។ អ្នកឈ្នះ Live Spin មិនចូលលំដាប់កាដូលើកទឹកចិត្តដដែលទេ។"],
  ["Spin Settings និងការផ្អាក", "Owner អាចកំណត់ per-event ថាតើ spin បើក/បិទ, ticket threshold, ចំនួនអ្នកឈ្នះ និងចំនួនកាដូលើកទឹកចិត្ត។ Settings សកម្មត្រូវបង្ហាញនៅ Live Spin page និងកត់ត្រាក្នុង audit log។ ប្រសិនបើ Spin ត្រូវបានផ្អាក tickets ដែលមានសិទ្ធិនឹងនៅ active និង roll over ទៅ event បន្ទាប់។"],
  ["Fairness និងការបង្ហាញលទ្ធផល", "មុន Live Spin ប្រព័ន្ធនឹង lock បញ្ជីអ្នកចូលរួម, prize tiers និង rules snapshot ហើយបង្កើត commitment សម្រាប់លទ្ធផល។ អ្នកឈ្នះ 3 នាក់ត្រូវជ្រើសដោយ server-side cryptographic process មិនមាន client API សម្រាប់កំណត់លទ្ធផលទេ។ Connection-duration ranking, settings snapshot និង winner results ត្រូវបានកត់ត្រាក្នុង immutable audit/proof; fairness seed ត្រូវបង្ហាញបន្ទាប់ពី prize reveal។ ZURS អាចពន្យារ ឬលុបកម្មវិធីក្នុងករណីសុវត្ថិភាព បច្ចេកទេស ឬតម្រូវការផ្លូវច្បាប់។"],
] as const;

export default function Legal({ kind }: { kind: LegalKind }) {
  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "គោលការណ៍ឯកជនភាព" : "លក្ខខណ្ឌប្រើប្រាស់";
  const intro = isPrivacy ? "របៀបដែល ZURS STORE គោរព ការពារ និងប្រើព័ត៌មានរបស់អ្នកដោយតិចបំផុតតាមដែលចាំបាច់។" : "សូមអានលក្ខខណ្ឌសំខាន់ៗ មុនប្រើប្រាស់សេវា Top-up និងគណនី ZURS STORE។";
  const sections = isPrivacy ? privacySections : termsSections;
  return <StorefrontLayout><main className="container max-w-3xl py-8 sm:py-12 zp-page"><Reveal as="section" index={0}><Link href="/" className="text-sm font-bold text-neon">← ត្រឡប់ទៅទំព័រដើម</Link><header className="mt-4 rounded-2xl bg-slate-950 p-5 text-white sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">{isPrivacy ? <ShieldCheck className="h-5 w-5 text-emerald-200" /> : <FileText className="h-5 w-5 text-indigo-200" />}</div><div><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-200">ZURS STORE</p><h1 className="mt-1 font-display text-2xl font-bold">{title}</h1></div></div><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{intro}</p></header><section className="mt-5 space-y-3">{sections.map(([heading, copy], index) => <article key={heading} className="surface rounded-2xl p-4 sm:p-5"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">{index + 1}</span><div><h2 className="text-sm font-bold text-slate-900">{heading}</h2><p className="mt-2 text-xs leading-6 text-slate-600">{copy}</p></div></div></article>)}</section><p className="mt-6 text-center text-[11px] text-slate-500">អាប់ដេតចុងក្រោយ៖ 27 សីហា 2026 · Live Spin Terms/Privacy នេះជាសេចក្តីព្រាងប្រតិបត្តិការ និងគួរត្រូវបានពិនិត្យដោយអ្នកជំនាញផ្លូវច្បាប់មុនបើកជាសាធារណៈ។</p></Reveal></main></StorefrontLayout>;
}
