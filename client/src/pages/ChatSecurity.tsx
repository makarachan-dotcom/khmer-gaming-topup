import { Link } from "wouter";
import { ArrowLeft, Image as ImageIcon, KeyRound, Lock, ShieldCheck, Timer } from "lucide-react";
import { SUPPORT_CHAT_PATH } from "@/lib/supportChat";

/**
 * `/chat/security` — plain-language explainer for the encryption used by the
 * live support chat. Linked from the shield chip in the chat header.
 */
export function ChatSecurity() {
  return (
    <main className="zcp">
      <article className="zcp-doc">
        <Link href={SUPPORT_CHAT_PATH} className="zcp-back" aria-label="ត្រឡប់ទៅការជជែក">
          <ArrowLeft size={18} />
        </Link>

        <h1 style={{ marginTop: 16 }}>
          <ShieldCheck size={22} style={{ display: "inline", marginRight: 8, verticalAlign: "-3px", color: "#86efac" }} />
          ការជជែកនេះត្រូវបានអ៊ិនគ្រីបចុងដល់ចុង
        </h1>
        <p>
          សារ និងរូបភាពទាំងអស់ត្រូវបានចាក់សោនៅក្នុងកម្មវិធីរុករករបស់អ្នក <b>មុននឹងចាកចេញពីទូរស័ព្ទ</b>។
          មានតែឧបករណ៍របស់អ្នក និងឧបករណ៍របស់ក្រុមជំនួយប៉ុណ្ណោះដែលមានសោដើម្បីបើកវា។
        </p>

        <div className="zcp-steps">
          <div className="zcp-step" style={{ animationDelay: "40ms" }}>
            <span className="zcp-step__num">1</span>
            <div>
              <b>សោត្រូវបានបង្កើតនៅលើឧបករណ៍</b>
              <p>ក្រុមជំនួយបោះពុម្ពសោសាធារណៈ (ECDH P-256) មួយ។ កម្មវិធីរុករករបស់អ្នកបង្កើតគូសោថ្មីសម្រាប់ការជជែកនីមួយៗ។</p>
            </div>
          </div>
          <div className="zcp-step" style={{ animationDelay: "110ms" }}>
            <span className="zcp-step__num">2</span>
            <div>
              <b>សោសម្ងាត់មិនត្រូវបានផ្ញើទេ</b>
              <p>ភាគីទាំងពីរគណនាសោរួម (ECDH → HKDF-SHA256 → AES-GCM 256-bit) ដោយខ្លួនឯង។ ម៉ាស៊ីនមេមិនដែលឃើញវាទេ។</p>
            </div>
          </div>
          <div className="zcp-step" style={{ animationDelay: "180ms" }}>
            <span className="zcp-step__num">3</span>
            <div>
              <b>មូលដ្ឋានទិន្នន័យឃើញតែអក្សរសម្ងាត់</b>
              <p>អ្វីដែលរក្សាទុកគឺ <code>zurs-e2ee.v1.…</code> ។ រូបភាពត្រូវបានផ្ទុកឡើងជា bytes ដែលបានចាក់សោរួច។</p>
            </div>
          </div>
          <div className="zcp-step" style={{ animationDelay: "250ms" }}>
            <span className="zcp-step__num">4</span>
            <div>
              <b>លេខសុវត្ថិភាព</b>
              <p>លេខ ៤ ក្រុម និងរូបតំណាង ៥ នៅលើក្បាលការជជែក ត្រូវតែដូចគ្នាទាំងសងខាង។ បើខុសគ្នា សូមឈប់ជជែក ហើយរាយការណ៍មកយើង។</p>
            </div>
          </div>
        </div>

        <h2>
          <KeyRound size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          អ្វីដែលយើងមិនអាចអានបាន
        </h2>
        <ul>
          <li>អត្ថបទសាររបស់អ្នក</li>
          <li>រូបភាពដែលអ្នកផ្ញើ</li>
        </ul>

        <h2>
          <Lock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          អ្វីដែលនៅតែមើលឃើញ (metadata)
        </h2>
        <ul>
          <li>លេខសំដៅការជជែក ប្រធានបទ និងម៉ោងផ្ញើ</li>
          <li>គណនីដែលបានបើកការជជែក និងលេខតាមដានការទិញ (បើភ្ជាប់)</li>
          <li>ចម្លើយដែលក្រុមជំនួយផ្ញើតាម Telegram bot — ចម្លើយប្រភេទនេះ <b>មិនអ៊ិនគ្រីបចុងដល់ចុងទេ</b> ហើយត្រូវបានដាក់ស្លាកច្បាស់លាស់នៅក្នុងការជជែក</li>
        </ul>

        <h2>
          <ImageIcon size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          រូបភាពប៉ុណ្ណោះ
        </h2>
        <p>
          ការផ្ញើសារជាសំឡេងត្រូវបានដកចេញ។ អ្នកអាចផ្ញើបានតែរូបភាព (JPG, PNG, WEBP ក្រោម 5 MB) ដែលត្រូវបានបង្រួម
          និងអ៊ិនគ្រីបនៅលើឧបករណ៍របស់អ្នកជាមុនសិន។
        </p>

        <h2>
          <Timer size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          ២ ការជជែក ក្នុង ១ ថ្ងៃ
        </h2>
        <p>
          គណនីនីមួយៗអាចទាក់ទងក្រុមជំនួយបាន <b>២ ដង</b>ក្នុងមួយថ្ងៃ (តាមម៉ោងភ្នំពេញ)។ ពេលក្រុមជំនួយបិទការជជែក
          វាត្រូវបានរាប់ជា ១ ដងសម្រាប់ថ្ងៃនោះ — បើនៅសល់ដង អ្នកអាចបើកការជជែកថ្មីបានភ្លាមៗ។
          សារផ្ញើចូលការជជែកដែលបានបិទ នឹងមិនត្រូវបានបញ្ជូនទេ។
        </p>

        <p style={{ marginTop: 22 }}>
          <Link href={SUPPORT_CHAT_PATH} className="zcp-cta" style={{ display: "inline-block", width: "auto", padding: "11px 20px" }}>
            ត្រឡប់ទៅការជជែក
          </Link>
        </p>
      </article>
    </main>
  );
}

export default ChatSecurity;
