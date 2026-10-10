// قالب‌های پیش‌فرضِ چاپ که با نصب ساخته می‌شوند (فقط اگر برای آن نوع سند هیچ قالبی وجود نداشته باشد؛ بعداً از صفحه‌ی «قالب‌های چاپ» قابل ویرایش‌اند).
// قالب = HTML/CSS با متغیرهای Handlebars؛ فهرست متغیرهای هر نوع سند در services/printService.ts (فیلدهای دیکشنری) آمده است.

export interface DefaultPrintTemplate {
  documentType: "SALES_QUOTE" | "SALES_INVOICE" | "JOURNAL_ENTRY";
  title: string;
  paper: "A4" | "A5";
  orientation: "PORTRAIT" | "LANDSCAPE";
  marginMm: number;
  digits: "LATIN" | "PERSIAN";
  html: string;
  texts: Record<string, string>;
}

// پیش‌فاکتور کالا و خدمات — A4 افقی؛ بازسازی فرمت چاپی شرکت (سربرگ با لوگو، مشخصات فروشنده/خریدار، جدول ۱۰ ستونی، شرایط، دو حساب بانکی،
// کادر مهر و امضا و watermark) با فونت وزیرمتن.
const SALES_QUOTE_HTML = `<style>
  .sheet { position: relative; }
  .top-note { display: flex; justify-content: space-between; font-size: 7.5pt; color: #444; padding-bottom: 1mm; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.4mm solid #333; padding-bottom: 1.2mm; margin-bottom: 1mm; }
  .head .brand { display: flex; align-items: center; gap: 4mm; }
  .head .brand img { height: 14mm; width: auto; }
  .head .brand .co { font-size: 13.5pt; font-weight: 700; }
  .head .brand .ttl { font-size: 11pt; font-weight: 700; margin-top: 1mm; }
  .head .meta { font-size: 8.5pt; line-height: 1.8; text-align: right; }
  .head .meta b { font-weight: 700; }
  .sec-title { background: #e9e9e9; border: 0.2mm solid #666; border-bottom: none; font-weight: 700; font-size: 9pt; padding: 0.6mm 2mm; margin-top: 1.6mm; }
  table.kv, table.items, table.totals { width: 100%; border-collapse: collapse; }
  table.kv td { border: 0.2mm solid #666; padding: 0.5mm 2mm; font-size: 8.5pt; vertical-align: top; }
  table.kv td .k { color: #333; }
  table.items th { background: #f1f1f1; border: 0.2mm solid #666; font-size: 8.5pt; padding: 0.9mm 1mm; font-weight: 700; text-align: center; }
  table.items td { border: 0.2mm solid #666; font-size: 8.5pt; padding: 0.8mm 1.2mm; text-align: center; }
  table.items td.t { text-align: right; }
  table.items td.n { direction: ltr; unicode-bidi: plaintext; }
  table.items tfoot td { background: #f7f7f7; font-weight: 700; }
  table.items thead { display: table-header-group; }
  table.items tr { page-break-inside: avoid; }
  .banks .terms { font-size: 8.5pt; line-height: 1.7; }
  .banks { display: flex; gap: 6mm; margin-top: 1.5mm; font-size: 8.5pt; line-height: 1.6; }
  .banks .bank { flex: 1; }
  .banks .bank .h { font-weight: 700; }
  .banks .ltr { direction: ltr; unicode-bidi: plaintext; text-align: right; display: inline-block; }
  .sign { display: flex; gap: 6mm; margin-top: 2.5mm; page-break-inside: avoid; }
  .sign .box { flex: 1; border: 0.2mm solid #666; height: 34mm; font-size: 8.5pt; padding: 1.5mm 2mm; position: relative; }
  /* اندازه‌ی واقعی مهر و امضا مثل نمونه (ارتفاع ۴۲ میلی‌متر، بدون تغییر نسبت)؛ در صورت نیاز از کادر بیرون می‌زند */
  .sign .box img { position: absolute; left: 50%; top: -4mm; transform: translateX(-50%); height: 42mm; width: auto; max-width: none; }
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); white-space: nowrap; font-size: 80pt; font-weight: 700; color: rgba(0, 0, 0, 0.055); z-index: 0; pointer-events: none; }
</style>
<div class="sheet">
  {{#if t.watermark}}<div class="wm">{{t.watermark}}</div>{{/if}}
  <div class="top-note"><span>{{company.website}}</span><span>{{t.topNote}}</span></div>
  <div class="head">
    <div class="brand">
      {{#if company.logo}}<img src="{{company.logo}}" alt="">{{/if}}
      <div>
        <div class="co">{{company.name}}</div>
        <div class="ttl">{{t.title}}</div>
      </div>
    </div>
    <div class="meta">
      <div><b>شماره سریال:</b> {{doc.number}}</div>
      <div><b>تاریخ:</b> {{doc.date}}</div>
      <div><b>تاریخ اعتبار:</b> {{doc.validUntil}}</div>
    </div>
  </div>

  <div class="sec-title">مشخصات فروشنده</div>
  <table class="kv">
    <tr>
      <td style="width:42%"><span class="k">نام شخص حقیقی/حقوقی:</span> {{company.name}}</td>
      <td style="width:29%"><span class="k">شماره اقتصادی:</span> {{company.economicCode}}</td>
      <td style="width:29%"><span class="k">شماره ثبت:</span> {{company.registrationNumber}}</td>
    </tr>
    <tr>
      <td><span class="k">شماره تلفن:</span> {{company.phone}}</td>
      <td><span class="k">کد ملی/شناسه ملی:</span> {{company.nationalId}}</td>
      <td><span class="k">کد پستی:</span> {{company.postalCode}}</td>
    </tr>
    <tr><td colspan="3"><span class="k">نشانی:</span> {{company.address}}</td></tr>
  </table>

  <div class="sec-title">مشخصات خریدار</div>
  <table class="kv">
    <tr>
      <td style="width:42%"><span class="k">نام شخص حقیقی/حقوقی:</span> {{customer.name}}</td>
      <td style="width:29%"><span class="k">شماره اقتصادی:</span> {{customer.economicCode}}</td>
      <td style="width:29%"><span class="k">شماره ثبت:</span> {{customer.registrationNumber}}</td>
    </tr>
    <tr>
      <td><span class="k">تلفن:</span> {{customer.phone}}</td>
      <td><span class="k">کد ملی/شناسه ملی:</span> {{customer.nationalId}}</td>
      <td><span class="k">کد پستی:</span> {{customer.postalCode}}</td>
    </tr>
    <tr><td colspan="3"><span class="k">نشانی:</span> {{customer.address}}</td></tr>
  </table>

  <div class="sec-title">مشخصات کالا یا خدمات</div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:4%">ردیف</th><th>شرح کالا/خدمت</th><th style="width:7%">تعداد</th><th style="width:5%">واحد</th>
        <th style="width:9%">مبلغ واحد</th><th style="width:11%">مبلغ کل</th><th style="width:10%">مبلغ تخفیف</th>
        <th style="width:11%">مبلغ پس از تخفیف</th><th style="width:10%">ارزش افزوده</th><th style="width:11%">خالص فاکتور</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td>{{row}}</td><td class="t">{{title}}{{#if description}} - {{description}}{{/if}}</td><td class="n">{{quantity}}</td><td>{{unit}}</td>
        <td class="n">{{unitPrice}}</td><td class="n">{{amount}}</td><td class="n">{{discount}}</td>
        <td class="n">{{afterDiscount}}</td><td class="n">{{vat}}</td><td class="n">{{net}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5">جمع کل</td>
        <td class="n">{{totals.amount}}</td><td class="n">{{totals.discount}}</td>
        <td class="n">{{totals.afterDiscount}}</td><td class="n">{{totals.vat}}</td><td class="n">{{totals.net}}</td>
      </tr>
      <tr><td colspan="10" class="t">مبلغ کل به حروف: {{totals.netInWords}}</td></tr>
    </tfoot>
  </table>

  <div class="banks">
    <div class="terms">
      <div><b>شرایط و نحوه فروش:</b> {{t.salesTerms}}</div>
      <div><b>محل تحویل:</b> {{t.deliveryPlace}}</div>
    </div>
    {{#each company.bankAccounts}}
    <div class="bank">
      <div class="h">مشخصات حساب بانکی {{no}}:</div>
      <div>{{bankName}}{{#if branch}} شعبه {{branch}}{{/if}}</div>
      <div>شماره حساب: <span class="ltr">{{accountNumber}}</span></div>
      {{#if iban}}<div>شماره شبا: <span class="ltr">{{iban}}</span></div>{{/if}}
    </div>
    {{/each}}
  </div>

  <div class="sign">
    <div class="box">مهر و امضاء فروشنده:{{#if company.stamp}}<img src="{{company.stamp}}" alt="">{{/if}}</div>
    <div class="box">مهر و امضاء خریدار:</div>
  </div>
</div>`;

// صورتحساب فروش — همان قالب پیش‌فاکتور بدون «تاریخ اعتبار» (عنوان و watermark از متن‌های ثابت قالب می‌آید)
const SALES_INVOICE_HTML = SALES_QUOTE_HTML.replace(
  '      <div><b>تاریخ اعتبار:</b> {{doc.validUntil}}</div>\n',
  '      {{#if doc.taxId}}<div><b>شماره منحصربه‌فرد مالیاتی:</b> {{doc.taxId}}</div>{{/if}}\n'
);

// سند حسابداری — A4 عمودی؛ بازسازی فرمت «Documents/سند حسابداری.pdf»: سربرگ سه‌بخشی (شماره سند و تاریخ | شرکت، عنوان و وضعیت | شماره عطف و شماره صفحه)،
// جدول «ردیف / شماره حساب / شرح / مبلغ جزء / بدهکار / بستانکار» با خطوط عمودیِ تا ته صفحه، جمع (با مبلغ به حروف) و چهار امضا.
// ردیف‌های هر حساب کل یک بلوک‌اند (کل ← معین ← تفصیلی‌ها ← شرح و مبلغ جزء)؛ صفحه‌بندی را سرور انجام می‌دهد (printJournalEntry.ts).
const JOURNAL_ENTRY_HTML = `<style>
  /* ارتفاع صفحه از کاغذ/جهت/حاشیه‌ی همین قالب می‌آید ({{layout.contentHeightMm}}). ظرفیت ردیف هر صفحه را سرور از همین ارتفاع و فضای سربرگ/پاورقیِ این قالب (حدود ۶۴ میلی‌متر) برآورد می‌کند؛ اگر سربرگ یا امضا را بزرگ‌تر کردید، خروجی به ورق بعد می‌رود و چیزی بریده نمی‌شود. */
  .page { box-sizing: border-box; min-height: {{layout.contentHeightMm}}mm; border: 0.35mm solid #222; display: flex; flex-direction: column; position: relative; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); white-space: nowrap; font-size: 80pt; font-weight: 700; color: rgba(0, 0, 0, 0.055); z-index: 0; pointer-events: none; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; padding: 3.5mm 4mm 2.5mm; min-height: 21mm; position: relative; z-index: 1; }
  .hd .side { width: 52mm; font-size: 9pt; font-weight: 700; }
  .hd .side .r { display: flex; align-items: center; gap: 2mm; margin-bottom: 2.2mm; min-height: 11mm; }
  .hd .side .r.s { min-height: 0; margin-bottom: 0; }
  .hd .ell { box-sizing: border-box; min-width: 17mm; height: 11mm; padding: 0 2.5mm; border: 0.3mm solid #222; border-radius: 50%; background: #efefef; display: flex; align-items: center; justify-content: center; font-size: 11pt; font-weight: 700; }
  .hd .mid { flex: 1; text-align: center; line-height: 1.75; }
  .hd .mid .co { font-size: 13.5pt; font-weight: 700; }
  .hd .mid .ttl { font-size: 10.5pt; font-weight: 700; }
  .hd .mid .st { font-size: 9.5pt; font-weight: 700; }
  table.g { width: 100%; border-collapse: collapse; table-layout: fixed; position: relative; z-index: 1; }
  table.g th { border-top: 0.35mm solid #222; border-bottom: 0.35mm solid #222; font-size: 9pt; font-weight: 700; padding: 1.1mm 0; text-align: center; }
  table.g td { padding: 0.45mm 1.6mm; font-size: 8.5pt; line-height: 1.5; vertical-align: top; }
  .grid { position: relative; flex: 1; display: flex; flex-direction: column; }
  .grid .vl { position: absolute; top: 0; bottom: 0; width: 0; border-right: 0.25mm solid #222; z-index: 0; }
  .body { position: relative; flex: 1; }
  .body table.g { position: relative; z-index: 1; }
  td.c-no { text-align: center; }
  td.c-acc { text-align: center; }
  td.c-text { text-align: right; }
  td.c-n { text-align: center; direction: ltr; }
  tr.r-kol td.c-acc, tr.r-kol td.c-text { text-decoration: underline; font-size: 8pt; }
  tr.r-kol td.c-n { font-weight: 700; }
  tr.r-mid td.c-acc, tr.r-mid td.c-text { font-size: 8.5pt; }
  tr.r-leaf td.c-acc, tr.r-leaf td.c-text { font-weight: 700; font-size: 9.5pt; }
  tr.r-detail td.c-text { text-decoration: underline; }
  tr.r-desc td { padding-bottom: 1.6mm; }
  tr.r-kol td { padding-top: 1.6mm; }
  .ft { position: relative; z-index: 1; border-top: 0.35mm solid #222; }
  table.g.sum td { font-size: 9pt; font-weight: 700; padding: 1.6mm 1.6mm; vertical-align: middle; }
  table.g.sum td.c-n { text-align: center; }
  .sign { display: flex; justify-content: space-between; padding: 2.5mm 4mm 2mm; min-height: 16mm; font-size: 9pt; font-weight: 700; border-top: 0.2mm solid #888; }
  .sign div { flex: 1; text-align: right; }
</style>
{{#if t.watermark}}<div class="wm">{{t.watermark}}</div>{{/if}}
{{#each pages}}
<div class="page">
  <div class="hd">
    <div class="side">
      <div class="r"><span>شماره سند:</span><span class="ell">{{@root.doc.number}}</span></div>
      <div class="r s"><span>تاریخ سند:</span><span>{{@root.doc.date}}</span></div>
    </div>
    <div class="mid">
      <div class="co">{{@root.company.name}}</div>
      <div class="ttl">{{@root.t.title}}</div>
      <div class="st">وضعیت سند: {{@root.doc.status}}</div>
    </div>
    <div class="side">
      <div class="r"><span>شماره عطف:</span><span class="ell">{{@root.doc.referenceNumber}}</span></div>
      <div class="r s"><span>شماره صفحه:</span><span>{{pageNo}}{{#if multiPage}} از {{pageCount}}{{/if}}</span></div>
    </div>
  </div>
  <div class="grid">
  <span class="vl" style="right:6%"></span><span class="vl" style="right:20%"></span><span class="vl" style="right:58%"></span><span class="vl" style="right:72%"></span><span class="vl" style="right:86%"></span>
  <table class="g">
    <colgroup><col style="width:6%"><col style="width:14%"><col style="width:38%"><col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup>
    <thead><tr><th>ردیف</th><th>شماره حساب</th><th>شرح</th><th>مبلغ جزء</th><th>بدهکار</th><th>بستانکار</th></tr></thead>
  </table>
  <div class="body">
    <table class="g">
      <colgroup><col style="width:6%"><col style="width:14%"><col style="width:38%"><col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup>
      <tbody>
        {{#each rows}}
        <tr class="r-{{kind}}"><td class="c-no">{{no}}</td><td class="c-acc">{{code}}</td><td class="c-text">{{text}}</td><td class="c-n">{{part}}</td><td class="c-n">{{debit}}</td><td class="c-n">{{credit}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  </div>
  <div class="ft">
    <table class="g sum">
      <colgroup><col style="width:6%"><col style="width:14%"><col style="width:38%"><col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup>
      <tr>
        <td colspan="4" class="c-text">{{#if isLast}}جمع: {{@root.totals.inWords}}{{else}}جمع این صفحه (ادامه در صفحه بعد){{/if}}</td>
        <td class="c-n">{{#if isLast}}{{@root.totals.debit}}{{else}}{{debit}}{{/if}}</td>
        <td class="c-n">{{#if isLast}}{{@root.totals.credit}}{{else}}{{credit}}{{/if}}</td>
      </tr>
    </table>
    <div class="sign">
      <div>تهیه کننده: {{@root.t.preparedBy}}</div>
      <div>بررسی کننده: {{@root.t.reviewedBy}}</div>
      <div>تایید کننده: {{@root.t.approvedBy}}</div>
      <div>تصویب کننده: {{@root.t.ratifiedBy}}</div>
    </div>
  </div>
</div>
{{/each}}`;

export const DEFAULT_PRINT_TEMPLATES: DefaultPrintTemplate[] = [
  {
    documentType: "SALES_QUOTE",
    title: "پیش‌فاکتور کالا و خدمات (A4 افقی)",
    paper: "A4",
    orientation: "LANDSCAPE",
    marginMm: 10,
    digits: "PERSIAN",
    html: SALES_QUOTE_HTML,
    texts: {
      title: "پیش فاکتور کالا و خدمات",
      topNote: "",
      salesTerms: "نقد",
      deliveryPlace: "درب انبار فروشنده",
      watermark: "پیش فاکتور",
      fileName: "پیش فاکتور {{customer.name}} - {{company.name}}",
    },
  },
  {
    documentType: "SALES_INVOICE",
    title: "صورتحساب فروش کالا و خدمات (A4 افقی)",
    paper: "A4",
    orientation: "LANDSCAPE",
    marginMm: 10,
    digits: "PERSIAN",
    html: SALES_INVOICE_HTML,
    texts: {
      title: "صورتحساب فروش کالا و خدمات",
      topNote: "",
      salesTerms: "نقد",
      deliveryPlace: "درب انبار فروشنده",
      watermark: "صورتحساب نهایی",
      fileName: "صورتحساب فروش {{customer.name}} - {{company.name}}",
    },
  },
  {
    documentType: "JOURNAL_ENTRY",
    title: "سند حسابداری (A4 عمودی)",
    paper: "A4",
    orientation: "PORTRAIT",
    marginMm: 8,
    digits: "PERSIAN",
    html: JOURNAL_ENTRY_HTML,
    texts: {
      title: "سند حسابداری",
      preparedBy: "",
      reviewedBy: "",
      approvedBy: "",
      ratifiedBy: "",
      watermark: "",
      fileName: "سند حسابداری {{doc.number}} - {{company.name}}",
    },
  },
];
