# OncoAgent: ভিডিও স্ক্রিপ্ট (২–৩ মিনিট)

**টিম DatourX · Idea to Unicorn 2026 · HealthSphere AI / PredictRx**
লক্ষ্য দৈর্ঘ্য **২:৪০**। ভিডিওতে সর্বোচ্চ ১০ নম্বর, যা পোর্টালের সবচেয়ে বড় অংশ।

- **Narration (ভয়েস):** ইংরেজিতে, কারণ বিচারকরা আন্তর্জাতিক। প্রতিটি দৃশ্যের নিচে বাংলা অর্থ দেওয়া আছে। চাইলে সেটি সাবটাইটেল বা বাংলা ভয়েস হিসেবে ব্যবহার করুন।
- **স্ক্রিন:** লাইভ সাইট https://oncoagent.vercel.app ও ডেক (স্লাইড ২ ও ১৫)।
- **সব রোগী কাল্পনিক।** ভিডিওতে একবার মুখে এবং স্ক্রিনে বলা আছে।

---

## রেকর্ডের আগে (১০ মিনিট)

1. **Chrome বা Edge-এ নতুন InPrivate/Incognito উইন্ডো** খুলুন। এতে অডিট লগ খালি থাকবে, কারণ ডেমো লগ ব্রাউজারে জমা থাকে।
2. একবার রিহার্সাল করুন: P-001 খুলে **Run agents live** চাপুন এবং প্রায় ২৫ সেকেন্ড অপেক্ষা করুন। প্রথম রান একটু ধীর হতে পারে (cold start)। তারপর উইন্ডো বন্ধ করে নতুন Incognito খুলে আসল টেক নিন।
3. P-001 পেজে নিচে **3D structure** অংশটি ঘুরিয়ে দেখুন। লোড হলে দৃশ্য ৫-এ ৩ সেকেন্ড দেখাবেন, না হলে বাদ দেবেন।
4. স্ক্রিন 1920×1080, ব্রাউজার জুম 100–110%। বুকমার্ক বার লুকান (Ctrl+Shift+B), অন্য ট্যাব বন্ধ রাখুন, Windows-এ Do Not Disturb চালু করুন।
5. রেকর্ডার: **Windows Snipping Tool** (Win+Shift+R) অথবা **OBS Studio** (ফ্রি)। মাইক্রোফোন হিসেবে ফোনের ইয়ারফোন যথেষ্ট, শুধু ঘর শান্ত রাখুন।
6. সহজ উপায়: আগে স্ক্রিন রেকর্ড করুন, পরে ভয়েস আলাদা করে রেকর্ড করে এডিটরে মেলান।

---

## দৃশ্য অনুযায়ী স্ক্রিপ্ট

### দৃশ্য ১ · সমস্যা (0:00–0:15)
**স্ক্রিন:** ডেক স্লাইড ২ (The problem) অথবা সাইটের Overview।
**Voice:**
> Lung cancer kills 1.8 million people a year, more than any other cancer. The right treatment often depends on a long gene report that a busy oncologist must check, by hand, against guidelines, trials and drug labels.

**বাংলা:** ফুসফুসের ক্যান্সারে বছরে ১৮ লাখ মানুষ মারা যান, যা অন্য যেকোনো ক্যান্সারের চেয়ে বেশি। সঠিক চিকিৎসা প্রায়ই একটি লম্বা জিন রিপোর্টের উপর নির্ভর করে। ব্যস্ত অনকোলজিস্টকে সেটি হাতে-কলমে গাইডলাইন, ট্রায়াল আর ওষুধের লেবেলের সাথে মিলিয়ে দেখতে হয়।

### দৃশ্য ২ · সমাধান (0:15–0:28)
**স্ক্রিন:** https://oncoagent.vercel.app। হিরো অংশ দেখান ("AI proposes. The doctor decides.")।
**Voice:**
> We are Team DatourX. This is OncoAgent: a team of AI agents for oncologists. The agents read every report and propose. The doctor decides. Every patient you will see is fictional.

**বাংলা:** আমরা টিম DatourX। এটি OncoAgent, অনকোলজিস্টদের জন্য AI এজেন্টদের একটি দল। এজেন্টরা প্রতিটি রিপোর্ট পড়ে প্রস্তাব দেয়, সিদ্ধান্ত নেন ডাক্তার। এখানে দেখানো সব রোগী কাল্পনিক।

### দৃশ্য ৩ · রোগী (0:28–0:48)
**স্ক্রিন:** Patients টেবিলে **Rahela Khatun · P-001** ক্লিক করুন। RECIST চার্টের শেষ লাল বিন্দুতে মাউস রাখুন (45 mm · PD), তারপর ctDNA চার্টে।
**Voice:**
> Here is a fictional patient on osimertinib. The Sentinel agent calculates RECIST 1.1 from her scans: a partial response, then progression at month fourteen. Her ctDNA came back first, and plasma testing found a resistance mutation, EGFR C797S.

**বাংলা:** ইনি একজন কাল্পনিক রোগী, osimertinib খাচ্ছেন। Sentinel এজেন্ট স্ক্যান থেকে RECIST 1.1 হিসাব করে: প্রথমে টিউমার কমেছে (partial response), তারপর ১৪তম মাসে আবার বেড়েছে (progression)। রক্তের ctDNA আগেই ফিরে এসেছিল, আর প্লাজমা টেস্টে EGFR C797S নামে একটি রেজিস্ট্যান্স মিউটেশন পাওয়া গেছে।

### দৃশ্য ৪ · এজেন্ট চালানো (0:48–1:15)
**স্ক্রিন:** **Claude synthesis** টিক দেওয়া আছে কিনা দেখুন, তারপর **Run agents live** চাপুন। ধাপগুলো একে একে সবুজ হবে। ২৩ সেকেন্ডের অপেক্ষা এডিটে ৪x দ্রুত করুন বা কেটে দিন, তবে স্ক্রিনের সময়-সংখ্যা যেন দেখা যায়।
**Voice:**
> I press Run. Nine agents work in order: genomic evidence from CIViC, missing tests, guideline options, drug interactions, recruiting trials from ClinicalTrials.gov, and dose calculators. Claude writes a tumour-board summary using only that evidence. Then a safety-critic checks every claim. The whole run takes about twenty-three seconds.

**বাংলা:** Run চাপলে নয়টি এজেন্ট পরপর কাজ করে: CIViC থেকে জিনের প্রমাণ, কোন টেস্ট বাকি, গাইডলাইনের বিকল্প, ওষুধের পারস্পরিক ঝুঁকি, ClinicalTrials.gov থেকে চলমান ট্রায়াল, আর ডোজ ক্যালকুলেটর। Claude শুধু সেই প্রমাণ দিয়ে টিউমার-বোর্ড সারাংশ লেখে। তারপর Safety-critic প্রতিটি দাবি যাচাই করে। পুরো রান প্রায় ২৩ সেকেন্ডের।

### দৃশ্য ৫ · কার্ড, প্রমাণ, ডোজ (1:15–1:45)
**স্ক্রিন:** নিচে স্ক্রল করে প্রথম treatment কার্ড দেখান এবং একটি evidence চিপে ক্লিক করুন। আগের রানে এটি ছিল amivantamab + carboplatin + pemetrexed, তবে লাইভ রানে Claude-এর ভাষা একটু আলাদা হতে পারে। তারপর QT safety কার্ড, তারপর **Dose card** (Carboplatin 460 mg, Pemetrexed 750 mg ও ফর্মুলা)। 3D structure লোড হলে ৩ সেকেন্ড দেখান।
**Voice:**
> Every card says why, cites its sources, and shows what would change the advice. The pharmacology agent caught a real risk: osimertinib and citalopram both prolong the QT interval. The dose card shows its working, Calvert formula and Cockcroft–Gault clearance, so carboplatin is 460 milligrams. A creatinine older than seven days would block the card.

**বাংলা:** প্রতিটি কার্ডে লেখা থাকে কেন এই প্রস্তাব, প্রমাণের উৎস কী, আর কী বদলালে পরামর্শ বদলাবে। ফার্মাকোলজি এজেন্ট একটি আসল ঝুঁকি ধরেছে: osimertinib আর citalopram দুটোই হৃদস্পন্দনের QT বাড়ায়। ডোজ কার্ডে পুরো হিসাব দেখানো আছে (Calvert ফর্মুলা, Cockcroft–Gault ক্লিয়ারেন্স), তাই carboplatin ৪৬০ মিলিগ্রাম। ক্রিয়েটিনিন রিপোর্ট ৭ দিনের বেশি পুরোনো হলে কার্ডটি আটকে যায়।

### দৃশ্য ৬ · ডাক্তার সিদ্ধান্ত নেন (1:45–2:02)
**স্ক্রিন:** treatment কার্ডে **Approve** চাপুন, কারণ লিখুন (যেমন "Agree; re-biopsy first, tumour board Friday"), তারপর **Approve and sign** চাপুন। নিচে Audit log-এ নতুন এন্ট্রি ও **hash chain intact** দেখান।
**Voice:**
> The AI cannot act on its own. The oncologist approves, modifies or rejects each card with a reason, and every decision is written to a hash-chained audit log.

**বাংলা:** AI নিজে কিছু করতে পারে না। অনকোলজিস্ট প্রতিটি কার্ড কারণসহ approve, modify বা reject করেন, আর প্রতিটি সিদ্ধান্ত হ্যাশ-চেইনড অডিট লগে লেখা হয়, যা পরে বদলানো যায় না।

### দৃশ্য ৭ · প্রমাণ (2:02–2:18)
**স্ক্রিন:** সাইডবারে **Evaluation** পেজ। উপরের ৮টি সংখ্যা, তারপর Red-team টেবিল দেখান।
**Voice:**
> We measure before we trust. On all three gold cases the driver and the leading option matched. Every citation and trial ID is real, and the critic caught six out of six unsafe drafts.

**বাংলা:** বিশ্বাস করার আগে আমরা মাপি। তিনটি gold কেসেই মূল জিন আর প্রধান চিকিৎসা-বিকল্প মিলেছে। প্রতিটি সূত্র আর ট্রায়াল আইডি আসল, আর critic ছয়টির মধ্যে ছয়টি বিপজ্জনক খসড়াই ধরেছে।

### দৃশ্য ৮ · MCP (2:18–2:30)
**স্ক্রিন:** সাইডবারে **MCP server** পেজ। এন্ডপয়েন্ট ও ৭টি টুলের তালিকা দেখান।
**Voice:**
> The same seven tools run as an MCP server, over stdio and Streamable HTTP, so any MCP client can use them.

**বাংলা:** এই সাতটি টুলই একটি MCP সার্ভার হিসেবে stdio আর Streamable HTTP-তে চলে, তাই যেকোনো MCP ক্লায়েন্ট এগুলো ব্যবহার করতে পারে।

### দৃশ্য ৯ · সমাপ্তি (2:30–2:42)
**স্ক্রিন:** ডেক স্লাইড ১৫ (DatourX লোগো + oncoagent.vercel.app)।
**Voice:**
> Lung cancer first, then breast and colorectal. OncoAgent: AI proposes, the doctor decides.

**বাংলা:** প্রথমে ফুসফুসের ক্যান্সার, তারপর ব্রেস্ট ও কোলোরেক্টাল। OncoAgent: AI প্রস্তাব দেয়, ডাক্তার সিদ্ধান্ত নেন।

---

## এডিট (২০–৩০ মিনিট)

- **Clipchamp** (Windows 11-এ আছে) বা **CapCut Desktop** ব্যবহার করুন।
- এজেন্ট রানের অপেক্ষার অংশ ৪x দ্রুত করুন।
- Auto-captions দিন। ইংরেজি সাবটাইটেল রাখলে বিচারকদের পড়তে সুবিধা হয়।
- মোট দৈর্ঘ্য **৩:০০-এর নিচে** রাখুন।
- শেষ ২ সেকেন্ডে স্ক্রিনে লিখুন: "Fictional patients only · Not a medical device".
- এক্সপোর্ট করুন 1080p-এ।

## YouTube আপলোড

- **Title:** OncoAgent: Agentic AI for Oncologists | Team DatourX | Idea to Unicorn 2026
- **Visibility:** পোর্টালে Public চাওয়া থাকলে Public দিন। না থাকলে Unlisted যথেষ্ট, কারণ লিংক থাকলে যে কেউ দেখতে পারে।
- **Description:**

```
OncoAgent is an agentic decision-support assistant for oncologists, starting with non-small-cell lung cancer. Nine agents read the case, grade genomic evidence (CIViC), find recruiting trials (ClinicalTrials.gov), check interactions and calculate doses; Claude writes a sourced tumour-board summary; a safety-critic checks every claim. The doctor approves, modifies or rejects every card.

Live demo: https://oncoagent.vercel.app
Code: https://github.com/shahriyar9507/oncoagent
MCP endpoint: https://oncoagent.vercel.app/api/mcp

All patients are fictional. Research prototype, not a medical device, not medical advice.
Team DatourX · Idea to Unicorn 2026 · HealthSphere AI / PredictRx
```

শেষে YouTube লিংক কপি করে পোর্টালের ভিডিও ঘরে বসান।
