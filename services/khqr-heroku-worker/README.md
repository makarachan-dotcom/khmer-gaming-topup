# ZURS KHQR Payment Worker

សេវានេះជា **worker សម្រាប់តាមដានស្ថានភាព KHQR** ដែលដំណើរការដាច់ពី ZURS main website។ វាមិនបង្កើត order, មិនបង្កើត QR, មិន grant package និងមិនបង្ហាញ credential ទេ។ Main site តែប៉ុណ្ណោះដែលបង្កើត QR, MD5 និង payment session ក្នុង ledger របស់ខ្លួន។ Worker ទទួលតែ session ដែលបានចុះបញ្ជីរួច, ពិនិត្យ MD5 ជាមួយ Bakong ហើយផ្ញើ callback ដែលចុះហត្ថលេខា HMAC ទៅ main site។

> **ស្ថានភាពសុវត្ថិភាព:** ការដាក់ source នេះក្នុង repository មិនបើកការទូទាត់ទេ។ Main-site payment master switch ត្រូវនៅ `OFF` រហូតដល់ម្ចាស់បានពិនិត្យ merchant readiness, secrets និង production rollout ជាក់លាក់។

## លំហូរការងារ

| ដំណាក់កាល | អ្នកទទួលខុសត្រូវ | សកម្មភាព |
|---|---|---|
| 1 | Main website | បង្កើត dynamic KHQR, MD5 និង session មាន expiry 5 នាទី នៅក្នុង ledger។ |
| 2 | Main website → Worker | ផ្ញើ `POST /api/track-payment` ជាមួយ `orderId`, `md5`, `amount`, `currency`, `expiresAt`, `callbackUrl` និង `X-API-Key`។ |
| 3 | Worker | រក្សា watch ក្នុង PostgreSQL ហើយ poll official `check_transaction_by_md5` តាម interval 3–15 វិនាទី។ |
| 4 | Worker → Main website | ផ្ញើ callback `payment.paid`, `payment.expired` ឬ `payment.verification_deferred` ដែលមាន HMAC-SHA256។ |
| 5 | Main website | ផ្ទៀងផ្ទាត់ HMAC, md5/order/amount/currency និងធ្វើ reconciliation ពី Bakong ម្តងទៀត មុន update ledger ដោយ idempotent។ |

Bakong documentation កំណត់ថា token renewal ប្រើ `POST /v1/renew_token` ជាមួយ registered email ហើយ MD5 status check ប្រើ Bearer access token ជាមួយ `POST /v1/check_transaction_by_md5`។ Success គឺ `responseCode: 0`។ [Bakong Open API documentation](https://api-bakong.nbc.gov.kh/)

## HTTP contract

### Health check

```text
GET /health
```

Endpoint នេះត្រឡប់តែ service health ហើយមិនបង្ហាញ token, merchant account, MD5 ឬ watch data ទេ។

### Create/reuse payment watch

```text
POST /api/track-payment
X-API-Key: <worker-api-key>
Content-Type: application/json
```

```json
{
  "orderId": "main-ledger-order-id",
  "md5": "khqr-md5",
  "amount": "stored-exact-amount",
  "currency": "KHR",
  "expiresAt": "ISO-8601 timestamp from main ledger",
  "callbackUrl": "https://www.zurs.me/api/webhooks/bakong"
}
```

`/api/payments/watch` ត្រូវបានរក្សាទុកជា alias សម្រាប់ compatibility ជាមួយ client ចាស់ប៉ុណ្ណោះ។ Worker បដិសេធ HTTP, MD5/order/currency មិនត្រឹមត្រូវ, expiry ផុតកំណត់, watch conflict និងលេខ watch លើសកំណត់។

### Callback payload

Worker ផ្ញើ raw JSON និង header `x-khqr-signature` ដែលជា hex HMAC-SHA256 នៃ raw body។ Main site ទទួលបានទាំង `/api/webhooks/bakong` និង `/api/webhooks/khqr-worker`; ផ្លូវទាំងពីរប្រើ validator និង reconciliation ដូចគ្នា។

```json
{
  "event": "payment.paid",
  "md5": "khqr-md5",
  "orderId": "main-ledger-order-id",
  "amount": "stored-exact-amount",
  "currency": "KHR",
  "timestamp": "ISO-8601"
}
```

`payment.expired` បិទតែ pending session ដែលផ្គូផ្គងទាំងអស់។ `payment.verification_deferred` ត្រូវប្រើសម្រាប់ Bakong daily request limit ប៉ុណ្ណោះ និងមិនមែនជាការទូទាត់ជោគជ័យ។

## Configuration

ចម្លង `.env.example` ទៅ `.env` **នៅលើម៉ាស៊ីន/host របស់ម្ចាស់តែប៉ុណ្ណោះ**។ កុំ commit `.env`, កុំ paste token ក្នុង issue, log ឬ chat។

| Variable | គោលបំណង | កំណត់សំខាន់ |
|---|---|---|
| `DATABASE_URL` | PostgreSQL សម្រាប់ watch ledger | ត្រូវមាន TLS លើ hosted database។ |
| `WORKER_API_KEY` | Authenticate main site → worker | ត្រូវមាន entropy ខ្ពស់ និងត្រូវដូច main-site worker key។ |
| `CALLBACK_HMAC_SECRET` | Sign worker → main-site callback | ត្រូវមាន 32+ characters និងត្រូវដូច main-site callback secret។ |
| `BAKONG_REGISTERED_EMAIL` | Email ចុះឈ្មោះជាមួយ Bakong | ប្រើសម្រាប់ official token renewal តែប៉ុណ្ណោះ។ |
| `BAKONG_ACCESS_TOKEN` | Bearer token ចាប់ផ្តើម | Worker refreshes token តាម API; មិន log ឬ return token ទេ។ |
| `POLL_INTERVAL_MS` | ចន្លោះពេល poll | អនុញ្ញាត 3000–15000ms។ កំណត់ដើមគឺ 3500ms។ |
| `MAX_ACTIVE_WATCHES` | កំណត់ watch pending | ការពារ provider quota និង resource exhaustion។ |

## Deploy ទៅ Heroku

មានពីរជម្រើសដែលអាចប្រើបាន។

| ជម្រើស | អត្ថប្រយោជន៍ | Trade-off | សមស្របសម្រាប់ |
|---|---|---|---|
| Worker Heroku នេះ | បំពេញសំណើ deploy ដាច់ដោយឡែក, មាន PostgreSQL watch ledger និង health endpoint | ត្រូវគ្រប់គ្រង Heroku app/database/secrets ដាច់ដោយឡែក | នៅពេលម្ចាស់ចង់បាន host ពិសេស។ |
| រត់ worker ជាមួយ service ប្រចាំរបស់ main platform | កាត់បន្ថយ infrastructure និង secret duplication | ត្រូវជ្រើស hosting ដែលអាចរត់ background polling បានជាប់ | នៅពេលចង់កាត់បន្ថយ operation។ |

ដើម្បី deploy ដោយដៃ បន្ទាប់ពីម្ចាស់បានពិនិត្យច្បាស់លាស់រួច៖

```bash
cd services/khqr-heroku-worker
cp .env.example .env
# Fill only real owner-provided values in the local .env; do not commit it.
heroku login
heroku create YOUR_UNIQUE_APP_NAME
CONFIG_FILE=.env ./deploy.sh YOUR_UNIQUE_APP_NAME
```

`deploy.sh` បដិសេធរត់ ប្រសិនបើ Heroku CLI មិនបាន login ឬ required config មិនទាន់មាន។ វា **មិន** auto-login, មិនបង្កើត credential, មិន provision paid database add-on និងមិនបើក main-site payment switch។ សម្រាប់ one-click review អាចប្រើ `app.json` ប៉ុន្តែ owner ត្រូវផ្គត់ផ្គង់ config values ដោយខ្លួនឯង។

## Production rollout checklist

មុនពេលបើក master switch ត្រូវធ្វើជាដាច់ខាត៖

1. ឲ្យម្ចាស់ផ្គត់ផ្គង់ និងបញ្ចូល Bakong merchant credentials តាម secure configuration channel។
2. បង្កើត worker API key និង callback HMAC secret ដែលមាន entropy គ្រប់គ្រាន់ ហើយដាក់តម្លៃត្រូវគ្នាទាំង main site និង worker។
3. Deploy worker និងបញ្ជាក់ `GET /health` មិនបង្ហាញព័ត៌មានសម្ងាត់។
4. Configure HTTPS worker URL និង callback URL លើ main site។
5. សាកល្បង non-financial/approved merchant test flow ដើម្បីបញ្ជាក់ HMAC, amount/currency match និង idempotency។
6. ឲ្យម្ចាស់អនុម័តជាក់លាក់សម្រាប់បើក master switch បន្ទាប់ពី review ទាំងអស់។

មិនត្រូវបើក switch, ផ្ញើ QR ទូទាត់ពិត, ឬដាក់/ផ្លាស់ប្ដូរ credential ដោយគ្មានការអនុម័តជាក់លាក់ពីម្ចាស់។
