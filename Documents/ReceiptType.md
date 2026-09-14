Receipt Type – نوع دریافت
1. هدف
مستر Receipt Type برای تعریف انواع مختلف دریافت در سیستم استفاده می‌شود.
این Master مشخص می‌کند:
•	دریافت از چه نوعی است.
•	دریافت بر اساس چه سندی انجام می‌شود.
•	در صورت بدون مبنا بودن دریافت، حساب معین مربوط به آن چیست.
•	چه نوع مبنایی متناسب با نوع دریافت قابل انتخاب است.
در فرم Receipt کاربر فقط نوع دریافت را انتخاب می‌کند و منطق تعیین حساب بر اساس نوع دریافت و مبنای انتخاب‌شده انجام می‌شود.
________________________________________
2. ساختار Entity
ReceiptType
- Id
- Code
- Name
- ReceiptType
- ReferenceType
- AccountingAccountId
- IsActive
فیلدها
Field	Type	Required	Description
Id	Guid / مطابق استاندارد سیستم	Yes	شناسه
Code	String	No	کد نوع دریافت
Name	String	Yes	عنوان نوع دریافت
ReceiptType	Enum	Yes	نوع دریافت
ReferenceType	Enum	Yes	نوع مبنای دریافت
AccountingAccountId	FK → AccountingAccount	Conditional	حساب معین
IsActive	Boolean	Yes	وضعیت فعال/غیرفعال
________________________________________
3. ReceiptType Enum
CustomerReceipt = دریافت از مشتری
AdvanceReceipt  = پیش‌دریافت
SupplierReceipt = دریافت از تأمین‌کننده
OtherReceipt    = دریافت از سایر
SalesVAT        = ارزش افزوده فروش
PurchaseVAT     = ارزش افزوده خرید
رفتار انواع دریافت
•	CustomerReceipt → دریافت از مشتری
•	AdvanceReceipt → پیش‌دریافت
•	SupplierReceipt → دریافت از تأمین‌کننده
•	OtherReceipt → دریافت از سایر
•	SalesVAT → مشابه دریافت از مشتری
•	PurchaseVAT → مشابه دریافت از تأمین‌کننده
________________________________________
4. ReferenceType Enum
None            = بدون مبنا
SalesInvoice    = فاکتور فروش
PurchaseInvoice = فاکتور خرید
SalesOrder      = سفارش فروش
ProformaInvoice = پیش‌فاکتور
________________________________________
5. کنترل نوع مبنا
نوع مبنا باید متناسب با نوع دریافت کنترل شود.
CustomerReceipt
    → None
    → SalesInvoice

AdvanceReceipt
    → None
    → SalesOrder
    → ProformaInvoice

SupplierReceipt
    → None
    → PurchaseInvoice

SalesVAT
    → None
    → SalesInvoice

PurchaseVAT
    → None
    → PurchaseInvoice

OtherReceipt
    → None
________________________________________
6. AccountingAccount
فیلد AccountingAccountId فقط زمانی نمایش داده شود که:
ReferenceType = None
در این حالت:
•	انتخاب حساب معین الزامی است.
•	حساب انتخاب‌شده به‌عنوان حساب پیش‌فرض آن نوع دریافت استفاده می‌شود.
اگر ReferenceType یکی از موارد زیر باشد:
SalesInvoice
PurchaseInvoice
SalesOrder
ProformaInvoice
فیلد AccountingAccountId نمایش داده نشود و مقدار آن نیز نباید ذخیره شود.
________________________________________
7. Code
•	ورود کد توسط کاربر اختیاری است.
•	در صورت وارد کردن کد، مقدار باید Unique باشد.
•	در صورت خالی بودن کد، سیستم به‌صورت خودکار کد تولید کند.
•	کد خودکار برابر آخرین کد + 1 باشد.
•	در صورت نبودن رکورد قبلی، اولین کد برابر 001 باشد.
•	کد باید Unique باشد.
________________________________________
8. IsActive
•	نوع داده: Boolean
•	مقدار پیش‌فرض: true
•	فقط انواع دریافت فعال در Selector فرم‌های عملیاتی قابل انتخاب باشند.
________________________________________
9. Validation
Name
الزامی است.
ReceiptType
الزامی است.
ReferenceType
الزامی است و باید متناسب با ReceiptType انتخاب شود.
AccountingAccountId
اگر:
ReferenceType = None
باشد، انتخاب حساب معین الزامی است.
در سایر حالت‌ها:
AccountingAccountId = null
باشد.
Code
در صورت ورود توسط کاربر باید Unique باشد.

