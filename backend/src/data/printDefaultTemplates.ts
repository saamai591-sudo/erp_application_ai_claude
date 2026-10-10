// قالب‌های پیش‌فرضِ چاپ که با نصب ساخته می‌شوند (فقط اگر برای آن نوع سند هیچ قالبی وجود نداشته باشد؛ بعداً از صفحه‌ی «قالب‌های چاپ» قابل ویرایش‌اند).
// قالب = HTML/CSS با متغیرهای Handlebars؛ فهرست متغیرهای هر نوع سند در services/printService.ts (فیلدهای دیکشنری) آمده است.

export interface DefaultPrintTemplate {
  documentType: "SALES_QUOTE" | "SALES_INVOICE";
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
];
