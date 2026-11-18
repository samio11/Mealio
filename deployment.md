# Vercel-এ Mealio deploy করার সম্পূর্ণ গাইড

এই গাইডে GitHub-এ থাকা Mealio repository-কে Vercel-এ deploy করার ধাপ দেওয়া হয়েছে। প্রজেক্টটি
একটি npm-workspace monorepo: `client/`-এ Next.js frontend এবং `server/`-এ Express API। তাই একই
GitHub repository থেকে Vercel-এ **দুটি আলাদা Project** তৈরি করতে হবে।

## Deploy করার আগে যা লাগবে

1. GitHub-এ এই repository-র সর্বশেষ code push করা থাকতে হবে।
2. GitHub account Vercel-এর সঙ্গে সংযুক্ত থাকতে হবে।
3. একটি PostgreSQL database লাগবে। Neon-এর PostgreSQL বা অন্য কোনো managed PostgreSQL ব্যবহার
   করা যাবে। Serverless deployment-এর জন্য provider-এর pooled/production connection string ব্যবহার
   করুন।
4. Google দিয়ে login চালু করতে চাইলে Google Cloud Console-এ OAuth Web Client তৈরি করতে হবে।
5. Custom domain ব্যবহার করলে domain-টি Vercel-এ যুক্ত ও verified থাকতে হবে। শুরুতে Vercel-এর
   `*.vercel.app` domain দিয়েও deploy ও পরীক্ষা করা যায়।

> **গুরুত্বপূর্ণ:** এখানে frontend ও API আলাদা Vercel Project হলেও browser-এর সব API request
> frontend domain-এর `/api/*` path দিয়ে যায়। Next.js সেগুলো API project-এ proxy করে। তাই
> `BETTER_AUTH_URL` এবং Google callback-এ **frontend-এর public URL** দিতে হবে; API project-এর
> URL নয়। এতে OAuth callback ও session cookie একই frontend domain-এ থাকে।

## ১. Production database তৈরি ও প্রস্তুত করুন

1. Neon বা আপনার PostgreSQL provider-এ একটি production database তৈরি করুন।
2. provider-এর connection string নিন। `DATABASE_URL`-এ hostname, database name, username,
   password এবং SSL/connection options ঠিক আছে কি না পরীক্ষা করুন।
3. Neon হলে serverless ব্যবহারের জন্য provider-এর pooled connection string বেছে নিন।
4. Database URL-টি কেবল Vercel-এর Environment Variables-এ রাখুন; GitHub-এ বা এই repository-র
   কোনো tracked `.env` ফাইলে লিখবেন না।
5. Production database-এ এখনো migration না চললে, পরের ধাপগুলোতে API Project তৈরি করে
`DATABASE_URL` Vercel-এ যোগ করার পর একই database-এর URL স্থানীয় `server/.env` ফাইলে সাময়িকভাবে
রাখুন (এই ফাইল Git-এ commit করবেন না), তারপর repository root থেকে চালান:

   ```powershell
   npm run prisma:deploy --workspace server
   ```

   এই command শুধু pending migration প্রয়োগ করে। Production database-এর জন্য
   `prisma:migrate` বা `prisma migrate dev` চালাবেন না। কাজ শেষে `server/.env` থেকে production
   URL মুছে local database URL ফিরিয়ে দিন। Migration প্রয়োগের আগে database backup নিন।

## ২. API-এর Vercel Project তৈরি করুন

1. Vercel Dashboard-এ **Add New → Project** নির্বাচন করুন।
2. GitHub repository import করুন।
3. **Root Directory** হিসেবে `server` নির্বাচন করুন।
4. Vercel-এর Express framework detection-টি রাখুন। শনাক্ত না হলে Root Directory `server` আছে কি
   না এবং `server/package.json`-এ Express dependency আছে কি না যাচাই করুন। Build Command, Output
   Directory এবং Install Command-এ শুরুতে repository-র স্বয়ংক্রিয় মান ব্যবহার করুন—অকারণে `dist`
   বা custom output directory সেট করবেন না।
5. **Settings → Environment Variables**-এ প্রথমে নিচের প্রয়োজনীয় variable-গুলো যোগ করুন।
   `.env` ফাইল Vercel-এ upload করবেন না; নিচের নামগুলো Vercel Dashboard-এ এক-একটি
   Environment Variable হিসেবে যোগ করুন। অন্তত **Production** environment-এ নির্বাচন করুন:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Production PostgreSQL connection string |
   | `BETTER_AUTH_SECRET` | নিরাপদ, এলোমেলো secret; কমপক্ষে ১৬ অক্ষর |

   Frontend Project তৈরি হওয়ার পর এর public URL জানা যাবে; তখন `FRONTEND_URL` ও
   `BETTER_AUTH_URL` যোগ/আপডেট করবেন। Google login ব্যবহার করলে Google-এর variable-গুলোও পরে
   যোগ করুন। `PORT` সেট করবেন না—Vercel নিজেই function চালায়।

   Production API-এর `.env`-এর মানগুলো দেখতে এ রকম হবে; `<...>` জায়গাগুলো নিজের আসল value দিয়ে
   পূরণ করবেন। এই block শুধু বোঝার জন্য—Vercel-এ প্রতিটি লাইন আলাদা variable হিসেবে সেট করবেন:

   ```dotenv
   NODE_ENV=production
   DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
   BETTER_AUTH_SECRET=<generated-random-secret>
   FRONTEND_URL=https://<frontend-domain>
   BETTER_AUTH_URL=https://<frontend-domain>
   GOOGLE_CLIENT_ID=<google-client-id>
   GOOGLE_CLIENT_SECRET=<google-client-secret>
   GOOGLE_CALLBACK_URL=https://<frontend-domain>/api/auth/callback/google
   ```

   Google login ব্যবহার না করলে শেষের তিনটি Google variable বাদ দিন। বাস্তব password বা key
   কখনো এই উদাহরণ, README, বা GitHub-এ বসাবেন না।

6. `BETTER_AUTH_SECRET` বানাতে নিজের কম্পিউটারে চালাতে পারেন:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   output Vercel-এর secret field-এ paste করুন; repository বা chat-এ লিখবেন না।
7. Project Deploy করুন। Deploy শেষ হলে API Project-এর URL লিখে রাখুন, যেমন
   `https://mealio-api.vercel.app`। API ঠিকমতো চালু আছে কি না দেখতে
   `https://<api-project-domain>/health` খুলুন। সফল হলে JSON-এ `status: "ok"` আসবে।

এই repository-র `server/src/server.ts` Vercel-এ Express app export করে এবং Vercel runtime-এ
নিজে `listen()` করে না; স্থানীয় `npm run dev:server` চালালে আগের মতোই server port-এ চালু হয়।

## ৩. Frontend-এর Vercel Project তৈরি করুন

1. আবার **Add New → Project** নির্বাচন করে একই GitHub repository import করুন।
2. **Root Directory** হিসেবে `client` নির্বাচন করুন।
3. Framework হিসেবে Next.js শনাক্ত হলে সেটি রাখুন। Build Command, Output Directory এবং Install
   Command-এ Vercel-এর স্বয়ংক্রিয় মান রাখুন।
4. Environment Variables-এ যোগ করুন:

   | Variable | Value |
   |---|---|
   | `API_PROXY_TARGET` | আগের ধাপে পাওয়া API Project-এর origin, যেমন `https://mealio-api.vercel.app` |

   URL-এর শেষে `/` দেবেন না। Variable-টি **Production** environment-এ যোগ করুন।
5. Project Deploy করুন। `API_PROXY_TARGET` বদলালে নতুন deployment করতে হবে, কারণ Next.js
   rewrite configuration deployment-এর সময় তৈরি হয়।
6. Deploy শেষে frontend-এর public URL লিখে রাখুন। API authentication এখনো পরীক্ষা করবেন না;
   পরের ধাপে API Project-এ frontend origin বসিয়ে redeploy করতে হবে।

## API-এর frontend origin সেট করুন

Frontend URL পাওয়ার পর API Vercel Project-এর **Settings → Environment Variables**-এ:

1. `FRONTEND_URL`-এ frontend-এর production origin দিন, যেমন `https://mealio.example.com`।
2. `BETTER_AUTH_URL`-এও একই origin দিন। API domain দেবেন না।
3. Google login ব্যবহার করলে Google OAuth-এর `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, এবং `GOOGLE_CALLBACK_URL` যোগ করুন। Callback হবে
   `https://<frontend-domain>/api/auth/callback/google`।
4. API Project redeploy করুন।
5. Frontend URL খুলে login page, registration, login/logout, session refresh, এবং
   `https://<frontend-domain>/health` পরীক্ষা করুন। Frontend-এ `/health` request API-তে proxy
   হয়।

## 4. Vercel Project settings যাচাই করুন

Frontend এবং API Project—দুটির **Settings → General → Node.js Version**-এ Node.js 22.x
নির্বাচন করুন (dashboard-এ থাকলে)। `package.json` Node.js 20+ চায়; Vercel project-এ
একই Node major রাখা হলে local ও production আচরণ কাছাকাছি থাকে।

দুটি Project-ই একই GitHub repository-র সঙ্গে যুক্ত থাকবে। Project-এর Production Branch সাধারণত
`main` রাখুন, অথবা আপনার production branch-এর নাম নির্বাচন করুন। এরপর ওই branch-এ push হলে
Vercel আলাদাভাবে frontend এবং API redeploy করবে।

Vercel build-এর সময় নতুন environment variable পড়তে নতুন deployment দরকার। variable যোগ বা
পরিবর্তনের পর Project-এর **Deployments → Redeploy** ব্যবহার করুন, অথবা GitHub-এ নতুন commit push
করুন।

## 5. Google OAuth সেটআপ (ঐচ্ছিক)

Google login ব্যবহার না করলে এই অংশ বাদ দিন। ব্যবহার করলে:

1. Google Cloud Console-এ একটি Google OAuth Client ID তৈরি করুন; Application type হিসেবে
   **Web application** নির্বাচন করুন।
2. **Authorized JavaScript origins**-এ frontend-এর production origin যোগ করুন:
   `https://<frontend-domain>`
3. **Authorized redirect URIs**-এ নিচের URL যোগ করুন:
   `https://<frontend-domain>/api/auth/callback/google`
4. `GOOGLE_CLIENT_ID` ও `GOOGLE_CLIENT_SECRET` API Vercel Project-এর Production Environment
   Variables-এ রাখুন।
5. API Project-এ `GOOGLE_CALLBACK_URL`-ও একই redirect URI দিন।
6. API Project redeploy করুন এবং frontend থেকে Google login পরীক্ষা করুন।

Custom domain যোগ বা পরিবর্তন করলে Google Console-এর origins ও redirect URI, API Project-এর
`FRONTEND_URL`, `BETTER_AUTH_URL`, `GOOGLE_CALLBACK_URL`, এবং frontend Project-এর
`API_PROXY_TARGET` সব যাচাই করুন। URL-এর protocol ও domain মিলিয়ে নিন; শেষে slash
দেবেন না, শুধু callback path-এ `/api/auth/callback/google` থাকবে।

## 6. ঐচ্ছিক integration

প্রয়োজন অনুযায়ী নিচের variable-গুলো API Project-এ যোগ করুন:

| Feature | Environment variables |
|---|---|
| Email/OTP ও password reset | `EMAIL_SENDER_SMTP_HOST`, `EMAIL_SENDER_SMTP_PORT`, `EMAIL_SENDER_SMTP_USER`, `EMAIL_SENDER_SMTP_PASS`, `EMAIL_SENDER_SMTP_FROM` |
| Profile photo ও private media | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| AI সহায়তা | `OPENROUTER_API_KEY`; প্রয়োজন হলে `OPENROUTER_BASE_URL`, `AI_TEXT_MODEL`, `AI_EMBEDDING_MODEL`, `GROQ_API_KEY`, `GEMINI_API_KEY` |
| প্রথমবার platform admin seed | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` |

এই integration-গুলো ঐচ্ছিক। কোনো key না দিলে সংশ্লিষ্ট feature বন্ধ থাকতে পারে। Admin seed
করতে database migration-এর পর নিরাপদ পরিবেশ থেকে একবার `npm run db:seed` চালান। শক্তিশালী
password ব্যবহার করুন এবং seed environment variable-এ স্থায়ী secret হিসেবে রাখার প্রয়োজন না
থাকলে পরে সরিয়ে দিন।

## 7. Preview deployment সম্পর্কে

Vercel Preview প্রতিটি branch/commit-এর জন্য আলাদা frontend URL তৈরি করতে পারে। API Project-এর
`FRONTEND_URL` ও `BETTER_AUTH_URL` হলো Better-Auth-এর trusted origin, আর Google Console-এর
callback URL-ও নির্দিষ্ট frontend domain-এ বাঁধা। তাই Production variable-গুলো Preview-তে
অন্ধভাবে কপি করলে Preview URL-এ authentication বা Google OAuth ব্যর্থ হতে পারে।

প্রথম production setup-এ Production environment variables-ই configure ও verify করুন। Preview-তে
auth পরীক্ষা করতে চাইলে frontend ও API-র Preview environment-এর জন্য স্থায়ী custom preview
domain ব্যবহার করে `API_PROXY_TARGET`, `FRONTEND_URL`, `BETTER_AUTH_URL`, এবং OAuth callback
সেই domain অনুযায়ী আলাদা করে configure করুন; Google OAuth provider-এও সেই callback অনুমোদন
করুন। Preview-তে production database ব্যবহার করবেন না—আলাদা test database নিন।

## 8. Deploy-পরবর্তী যাচাই তালিকা

- [ ] API URL-এর `/health` JSON-এ `status: "ok"` দেখায়।
- [ ] Frontend URL-এর `/health` একই API health response দেখায়।
- [ ] Registration, login, logout এবং page refresh-এর পর session কাজ করে।
- [ ] Google OAuth চালু থাকলে Google login এবং callback সফল হয়।
- [ ] Profile photo upload চালু থাকলে Cloudinary upload পরীক্ষা করা হয়।
- [ ] Production database-এ migration প্রয়োগ হয়েছে; Vercel logs-এ database error নেই।
- [ ] Vercel-এর Function Logs-এ API startup/runtime error নেই।
- [ ] Production secret কোনো Git commit বা public log-এ নেই।

## সাধারণ সমস্যা সমাধান

### Frontend-এ API error বা `500` আসে

- Frontend Project-এর `API_PROXY_TARGET` সঠিক API origin কিনা দেখুন; শেষে `/` দেবেন না।
- API Project-এর `/health` খুলে API চালু আছে কি না যাচাই করুন।
- API Project-এর Function Logs দেখুন। `DATABASE_URL`, migration, বা required environment
  variable-এর error আছে কি না পরীক্ষা করুন।
- `API_PROXY_TARGET` পরিবর্তনের পর frontend redeploy হয়েছে কি না নিশ্চিত করুন।

### `DATABASE_URL` বা Prisma connection error

- URL সঠিক database, user, password, SSL option এবং provider-এর serverless/pooler endpoint
  ব্যবহার করছে কি না যাচাই করুন।
- Password-এ `@`, `#`, `%`-এর মতো reserved character থাকলে connection URL-এ provider-এর নিয়মে
  URL-encode করুন।
- production database-এ pending migration থাকলে নিরাপদ backup-এর পর
  `npm run prisma:deploy --workspace server` চালান।
- Integration test কখনো production database-এ চালাবেন না।

### Auth-এ `origin not allowed`, cookie বা session সমস্যা

- `FRONTEND_URL` ও `BETTER_AUTH_URL` দুটোই frontend-এর সঠিক `https://` origin কিনা দেখুন; API
  project domain এখানে দেবেন না।
- Frontend-এর `API_PROXY_TARGET` API project-এর সঠিক URL কিনা দেখুন।
- Browser-এ frontend ও API-র মধ্যে redirect বা mixed HTTP/HTTPS নেই কি না দেখুন।
- Environment variable পরিবর্তনের পর API redeploy হয়েছে কি না নিশ্চিত করুন।

### Google-এ `redirect_uri_mismatch`

- Google Console-এর Authorized redirect URI হুবহু
  `https://<frontend-domain>/api/auth/callback/google` কিনা দেখুন।
- API Project-এর `GOOGLE_CALLBACK_URL`-ও একই কিনা যাচাই করুন।
- `GOOGLE_CLIENT_ID` ও `GOOGLE_CLIENT_SECRET` একই OAuth Client-এর pair কিনা দেখুন।
- পরিবর্তনের পর API Project redeploy করুন।

### Vercel build ব্যর্থ হয়

- দুই Project-এ Root Directory যথাক্রমে `client` এবং `server` কিনা যাচাই করুন।
- Node.js Version 22.x (বা project-এর 20+ requirement মেনে চলা version) কিনা দেখুন।
- Build log-এর প্রথম error অনুসারে কাজ করুন; সাধারণত missing environment variable, dependency
  install, TypeScript build, অথবা Prisma config-এর error থাকে।
- Install Command/Build Command custom করে থাকলে প্রথমে Vercel-এর automatic setting-এ ফিরিয়ে
  পরীক্ষা করুন।

## নিরাপত্তা মনে রাখুন

- Secret শুধু Vercel Project-এর Environment Variables বা secret manager-এ রাখুন।
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, Google secret, SMTP password, Cloudinary secret এবং AI
  key কোনো public repository-তে commit করবেন না।
- Vercel-এর `Production`, `Preview`, `Development` environment আলাদা করে নির্বাচন করুন।
- Production database-এর backup নিয়ে migration প্রয়োগ করুন।
- Secret প্রকাশ হয়ে গেলে provider-এ সেটি rotate করে Vercel variable update ও redeploy করুন।
