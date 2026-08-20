**1\. هدف**

این ماژول مسئول مدیریت **گردش مقداری کالا و موجودی انبار** در ERP است.

مسئولیت‌های ماژول:

- دریافت کالا
- خروج کالا
- انتقال بین انبارها
- مصرف کالا
- برگشت کالا
- مدیریت Batch
- مدیریت Serial
- مدیریت محل فیزیکی
- انبارگردانی
- بستن موجودی انبار
- محاسبه موجودی

مسئولیت‌های مالی شامل:

- نرخ
- مبلغ
- ارزش موجودی
- بهای تمام‌شده
- سند حسابداری

در ماژول **حسابداری انبار** قرار دارد و در این ماژول پیاده‌سازی نمی‌شود.

**2\. اصل معماری**

**2.1 Source of Truth**

منبع اصلی اطلاعات گردش کالا، **خود اسناد انبار** هستند.

سیستم نباید برای هر سند یک رکورد اضافی در InventoryTransaction ایجاد کند.

بنابراین:

InventoryTransaction = NOT USED

همچنین جدول دائمی:

StockBalance = NOT USED

وجود ندارد.

**3\. محاسبه موجودی**

**3.1 بدون Closing**

اگر برای انبار هیچ Closing وجود نداشته باشد:

CurrentStock =

SUM(Inbound)

\-

SUM(Outbound)

محاسبه باید بر اساس Dimensionهای موجودی انجام شود.

**3.2 با Closing**

اگر آخرین Closing انبار:

1405/05/31

باشد:

CurrentStock =

ClosingSnapshot

-

SUM(Inbound after ClosingDate)

\-

SUM(Outbound after ClosingDate)

**4\. Inventory Closing**

سیستم دارای عملیات:

**بستن موجودی انبار**

است.

هدف Closing:

1. محاسبه موجودی تا یک تاریخ مشخص
2. ذخیره Snapshot موجودی در آن تاریخ
3. جلوگیری از تغییر اسناد مربوط به دوره بسته‌شده
4. کاهش حجم محاسبات موجودی

Closing به معنی «غیرفعال کردن انبار» نیست.

**5\. Closing در سطح انبار**

Closing برای هر Warehouse مستقل است.

مثال:

Warehouse A → 1405/05/31

Warehouse B → 1405/04/31

Warehouse C → No Closing

هر انبار می‌تواند تاریخ Closing متفاوت داشته باشد.

**6\. ساختار InventoryClosing**

InventoryClosing

\-----------------------------

Id

WarehouseId

ClosingDate

ClosedAt

CreatedBy

CreatedAt

پیشنهاد:

Status

در صورت نیاز می‌تواند برای وضعیت‌های عملیاتی استفاده شود، ولی Reopen نباید یک Status مستقل باشد.

**7\. ساختار InventoryClosingLine**

InventoryClosingLine

\-----------------------------

Id

ClosingId

ItemId

WarehouseId

PhysicalLocationId

BatchId

SerialId

Quantity

Quantity مقدار موجودی واقعی در زمان Closing است.

**8\. Dimensionهای موجودی**

موجودی در سطح ترکیب Dimensionهای فعال کالا کنترل می‌شود.

Dimensionهای فعلی:

Item

Warehouse

PhysicalLocation

Batch

Serial

اگر یک Dimension برای کالا فعال نباشد، مقدار آن در رکورد موجودی:

NULL

است.

**9\. ترکیب Dimensionها**

مثلاً اگر کالا:

- Batch Controlled
- Serial Controlled
- Location Controlled

باشد، موجودی در سطح ترکیب زیر کنترل می‌شود:

Item

-

Warehouse

-

PhysicalLocation

-

Batch

-

Serial

مثال:

Item A / WH1 / L01 / B001 / SN001 = 1

Item A / WH1 / L02 / B001 / SN001 = 1

این دو موجودی مستقل هستند.

**10\. Batch**

Batch یک Master Data مستقل و مشترک در ERP است.

تمام ماژول‌ها از یک Batch Master استفاده می‌کنند.

Batch در Inventory Line ذخیره می‌شود.

**11\. Batch Entity**

حداقل اطلاعات:

Batch

\-----------------------------

Id

ItemId

BatchNumber

ProductionDate

ExpiryDate

SourceType

SupplierId

ProductionReferenceId

Status

Description

**12\. یکتایی Batch**

ترکیب:

ItemId + BatchNumber

باید Unique باشد.

یعنی:

Item A + B001

فقط یک Batch است.

ولی:

Item A + B001

Item B + B001

می‌تواند وجود داشته باشد.

**13\. تاریخ انقضا**

تاریخ انقضا فقط در Batch ذخیره می‌شود.

در Inventory Document Line:

ExpiryDate

وجود ندارد.

در صورت نیاز:

InventoryLine

↓

Batch

↓

ExpiryDate

**14\. ایجاد Batch**

Batch می‌تواند از چند مسیر ایجاد شود.

**دستی**

Batch Form

↓

BatchService

**خرید**

Purchase Receipt

↓

BatchService

↓

Batch

**تولید**

Production

↓

BatchService

↓

Batch

تمام این مسیرها باید در نهایت یک Batch Master مشترک ایجاد کنند.

**15\. SourceType Batch**

مقادیر پیشنهادی:

Manual

Purchase

Production

این مقدار صرفاً منشأ ایجاد Batch را مشخص می‌کند.

**16\. BatchService**

تمام ایجاد و Validation مربوط به Batch باید از یک Service مرکزی انجام شود.

حداقل APIهای داخلی:

CreateBatch()

GetBatch()

GetBatches()

ValidateBatch()

GenerateBatchNumber()

Production نباید مستقیماً جدول Batch را مدیریت کند.

**17\. Serial**

Serial یک Master مستقل است.

تعریف Serial در ماژول:

Products & Services

انجام می‌شود.

Inventory فقط Serialهای موجود را انتخاب و مصرف می‌کند.

**18\. Serial در Inventory Line**

Serial نباید در InventoryDocumentLine قرار گیرد.

مثلاً:

Item = Laptop

Quantity = 20

فقط یک Line داریم.

Serialها در Dialog انتخاب می‌شوند.

**19\. InventoryLineSerial**

InventoryLineSerial

\-----------------------------

Id

InventoryLineId

SerialId

مثال:

InventoryLine

|

+-- Serial 001

+-- Serial 002

+-- Serial 003

...

+-- Serial 020

بنابراین 20 Serial باعث ایجاد 20 Inventory Line نمی‌شود.

**20\. کنترل Serial**

برای کالای Serial Controlled:

Number of selected serials = Quantity

باید برقرار باشد.

در خروج:

Serial باید در همان ترکیب موجودی مورد نظر موجود باشد.

**21\. Physical Location**

Physical Location یکی از Dimensionهای موجودی است.

مثال:

Warehouse A

├── A01

├── A02

└── B01

در صورت فعال بودن Location Control، موجودی باید در سطح Location کنترل شود.

**22\. تنظیمات کالا**

حداقل تنظیمات موجودی کالا:

BatchControl

SerialControl

LocationControl

این تنظیمات تعیین می‌کنند که کدام Dimensionها برای کالا الزامی هستند.

**23\. فرم درخواست کالا**

فقط **یک فرم** برای درخواست وجود دارد.

نوع درخواست در Header مشخص می‌شود.

RequestType

\----------------------

Material

Project

Asset

در UI می‌توان عناوین فارسی زیر را نمایش داد:

درخواست کالا

درخواست پروژه

درخواست دارایی ثابت

**24\. BaseType حواله**

در Header اسناد خروجی:

BaseType

وجود دارد.

مقادیر فعلی:

None

Request

**25\. رفتار UI بر اساس BaseType**

اگر:

BaseType = None

باشد:

ستون Request در Grid نمایش داده نمی‌شود.

اگر:

BaseType = Request

باشد:

ستون Request نمایش داده می‌شود.

**26\. RequestType و BaseType**

این دو مفهوم نباید با هم ترکیب شوند.

مثلاً:

InventoryDocument.BaseType = Request

و Request انتخاب‌شده:

Request.RequestType = Project

است.

**27\. Reference در Header**

هیچ Request Reference در Header حواله وجود ندارد.

علت:

یک حواله می‌تواند چند Request را پوشش دهد.

بنابراین Reference فقط در Line است.

**28\. InventoryDocument**

ساختار پیشنهادی:

InventoryDocument

\-----------------------------

Id

DocumentNumber

DocumentDate

DocumentType

BaseType

WarehouseId

Description

CreatedBy

CreatedAt

**29\. InventoryDocumentLine**

InventoryDocumentLine

\-----------------------------

Id

DocumentId

RequestLineId

ItemId

UnitId

Quantity

BatchId

PhysicalLocationId

Description

**30\. RequestLineId**

RequestLineId فقط زمانی مقدار دارد که:

Document.BaseType = Request

باشد.

اگر:

BaseType = None

باشد:

RequestLineId = NULL

**31\. ارتباط Request و Inventory**

هر Inventory Line حداکثر به یک Request Line متصل می‌شود.

اما یک Request Line می‌تواند در چند Inventory Line تأمین شود.

مثال:

RequestLine:

A = 10

InventoryLine 1:

A = 6

InventoryLine 2:

A = 4

**32\. چند Request در یک حواله**

یک Inventory Document می‌تواند دارای Lineهای مربوط به چند Request باشد.

مثال:

Request 1 → A = 3

Request 2 → A = 3

Request 3 → B = 4

حواله:

Line 1 → Request1 / A / 3

Line 2 → Request2 / A / 3

اگر B موجود نباشد، Line مربوط به Request3 ایجاد نمی‌شود.

**33\. عدم تجمیع Request Lineها**

حتی اگر کالا یکی باشد، Lineها نباید تجمیع شوند.

غلط:

A = 6

صحیح:

Request1 / A / 3

Request2 / A / 3

این موضوع برای محاسبه مقدار تأمین‌شده و باقی‌مانده Request ضروری است.

**34\. انواع عملیات انبار**

**Inbound**

Purchase Receipt

Sales Return

Center Consumption Return

Project Consumption Return

Production Consumption Return

Production Receipt

Inventory Count Surplus

**Outbound**

Sales Issue

Center Consumption

Project Consumption

Production Consumption

Fixed Asset Issue

Supplier Return

Inventory Count Shortage

**Transfer**

Warehouse Transfer

**35\. ضایعات و امانی**

فعلاً در Scope این طراحی نیستند.

Waste = OUT OF SCOPE

Consignment = OUT OF SCOPE

**36\. Purchase Receipt**

Purchase

↓

Inventory Receipt

↓

Inventory +

برای Batch Controlled:

BatchId

الزامی است.

برای Serial Controlled:

Serialها از Dialog انتخاب می‌شوند.

**37\. Sales Issue**

Sales

↓

Inventory Issue

↓

Inventory -

Batch باید از موجودی انتخاب شود.

Serial باید از موجودی انتخاب شود.

**38\. Supplier Return**

Supplier Return

↓

Inventory -

Batch و Serial باید از موجودی موجود انتخاب شوند.

**39\. Consumption**

انواع:

Center Consumption

Project Consumption

Production Consumption

در صورت وجود مبنا:

BaseType = Request

و:

RequestLineId

در Line ثبت می‌شود.

**40\. Consumption Return**

انواع:

Center Consumption Return

Project Consumption Return

Production Consumption Return

هر برگشت باید به خروج مرتبط خود Reference داشته باشد.

کنترل:

ReturnedQuantity <= IssuedQuantity

**41\. Fixed Asset Issue**

در صورت وجود Request:

BaseType = Request

و:

RequestType = Asset

اطلاعات تخصصی دارایی:

- محل استقرار
- بهره‌بردار
- مشخصات دارایی
- سایر اطلاعات Asset

در ماژول Fixed Assets مدیریت می‌شوند.

**42\. Production**

**مصرف مواد**

Production

↓

Material Consumption

↓

Inventory -

**برگشت مواد**

Production

↓

Material Return

↓

Inventory +

**دریافت محصول**

Production

↓

BatchService

↓

Batch

↓

Inventory Receipt

**43\. Warehouse Transfer**

انتقال بین دو انبار از نظر موجودی دو اثر دارد:

Source Warehouse

↓

\-

Destination Warehouse

↓

-

Batch، Location و Serial باید در انتقال حفظ و کنترل شوند.

**44\. Inventory Count**

فرآیند:

Create Count

↓

Count

↓

Compare

↓

Confirm

↓

Generate Adjustment

نتایج فقط:

Shortage

Surplus

هستند.

**45\. Manual Inventory Adjustment**

کاربر می‌تواند به صورت دستی:

Inventory Count Shortage

Inventory Count Surplus

ایجاد کند.

نوع مستقلی به نام Manual Adjustment ایجاد نمی‌شود.

**46\. Document Status**

مرحله Posted وجود ندارد.

پس از ثبت نهایی سند:

Inventory is immediately affected

**47\. اصلاح سند**

سندهای ثبت‌شده قابل ویرایش یا حذف هستند، **مشروط به اینکه تاریخ مؤثر آنها داخل دوره باز انبار باشد** و کاربر مجوز لازم را داشته باشد.

بعد از Closing این امکان وجود ندارد.

**48\. Inventory Closing**

عملیات:

Close Inventory

کاربر:

Warehouse

ClosingDate

را مشخص می‌کند.

سیستم موجودی را تا ClosingDate محاسبه می‌کند و Snapshot می‌سازد.

**49\. Snapshot**

مثال:

ClosingDate = 1405/05/31

A / WH1 / L01 / B001 = 100

A / WH1 / L01 / B002 = 50

B / WH1 / L02 / NULL = 80

این اطلاعات در InventoryClosingLine ذخیره می‌شوند.

**50\. کنترل بعد از Closing**

اگر:

LastClosingDate = 1405/05/31

باشد، سند با:

DocumentDate <= 1405/05/31

قابل:

Create

Edit

Delete

نیست.

**51\. این کنترل باید در Backend باشد**

UI فقط باید وضعیت را نمایش دهد.

Backend در تمام عملیات:

Create

Update

Delete

باید بررسی کند:

DocumentDate > LastClosingDate

در غیر این صورت عملیات Reject شود.

**52\. برگشت بستن موجودی**

Reopen یک Status مستقل نیست.

عملیات:

**برگشت بستن موجودی**

یعنی **انتقال Closing به یک تاریخ قدیمی‌تر**.

مثال:

Current Closing = 1405/06/31

کاربر می‌خواهد سند مرداد را اصلاح کند.

کاربر:

Rollback Closing

را انتخاب می‌کند.

سیستم تاریخ جدید می‌خواهد:

New Closing Date = 1405/05/31

**53\. رفتار Rollback Closing**

پس از تأیید:

Closing 1405/06/31

↓

Rollback

↓

New Closing Date = 1405/05/31

سیستم Snapshot جدید را تا 1405/05/31 محاسبه می‌کند.

**54\. محاسبه مجدد Closing**

Closing جدید نباید از Snapshot قبلی 06/31 محاسبه شود.

باید از اسناد واقعی محاسبه شود:

SUM(Inbound <= 1405/05/31)

\-

SUM(Outbound <= 1405/05/31)

و نتیجه در Closing جدید ذخیره شود.

**55\. نتیجه Rollback**

اگر:

New Closing = 1405/05/31

باشد:

<= 1405/05/31

دوباره بسته است.

و:

\> 1405/05/31

دوباره باز است.

بنابراین اسناد مرداد قابل اصلاح خواهند بود.

**56\. مثال کامل Rollback**

وضعیت اولیه:

Closing = 1405/06/31

کاربر:

Rollback Closing

را اجرا می‌کند.

تاریخ:

1405/05/31

سیستم:

1. Closing قبلی را از محاسبات جاری خارج می‌کند.
2. موجودی واقعی تا 05/31 را از اسناد محاسبه می‌کند.
3. Snapshot جدید می‌سازد.
4. Closing جدید را 05/31 قرار می‌دهد.
5. اسناد تاریخ 06/01 به بعد را دوره باز در نظر می‌گیرد.
6. اسناد 05/31 و قبل همچنان بسته هستند.

**57\. محدودیت Rollback**

تاریخ جدید باید:

NewClosingDate < CurrentClosingDate

باشد.

Rollback به تاریخ آینده یا همان تاریخ مجاز نیست.

**58\. Audit Closing**

تمام عملیات Closing و Rollback باید Audit شوند.

اطلاعات:

Action

WarehouseId

OldClosingDate

NewClosingDate

UserId

ActionDateTime

Reason

مثال:

Action = RollbackClosing

OldClosingDate = 1405/06/31

NewClosingDate = 1405/05/31

User = User123

Reason = اصلاح حواله مرداد

**59\. نکته مهم درباره تاریخچه Closing**

حتی اگر Closing فعلی از:

1405/06/31

به:

1405/05/31

برگردد، عملیات قبلی نباید از Audit حذف شود.

تاریخچه باید باقی بماند.

**60\. محاسبه موجودی پس از Rollback**

بعد از Rollback:

CurrentStock =

NewClosingSnapshot

-

Inbound after NewClosingDate

\-

Outbound after NewClosingDate

**61\. Validationهای اصلی**

**Batch**

Item must match Batch.Item

**Serial**

Serial must belong to Item

Serial must be available for outbound

**Location**

Location must belong to Warehouse

**Request**

RequestLine.Item == InventoryLine.Item

**Quantity**

Quantity > 0

**Request Supply**

IssuedQuantity <= RemainingRequestQuantity

**Closing**

DocumentDate > LastClosingDate

برای ثبت/ویرایش/حذف.

**62\. اصل مهم موجودی**

در هیچ نقطه‌ای نباید صرفاً بر اساس:

ItemId

موجودی کنترل شود.

سیستم باید تمام Dimensionهای فعال کالا را در محاسبه لحاظ کند.

مثلاً:

Item

Warehouse

Location

Batch

Serial

**63\. معماری نهایی داده**

ERP

|

+------------+-------------+

| |

Master Data Modules

| |

+----+-----+ +---------+----------+

| | | | |

Batch Serial Purchase Sales Production

| | | | |

+----------+----------+---------+----------+

|

Inventory Module

|

+----------+----------+

| |

Inventory Documents Inventory Closing

| |

+-----+------+ |

| | |

Inbound Outbound |

| | |

+-----+------+--------------+

|

Stock Calculation

**64\. جداول اصلی پیشنهادی**

InventoryDocument

InventoryDocumentLine

InventoryLineSerial

Batch

InventoryClosing

InventoryClosingLine

و جداول Master مربوط به:

Item

Warehouse

PhysicalLocation

Serial

از ماژول‌های مربوطه استفاده می‌شوند.

**65\. جداولی که نباید ایجاد شوند**

InventoryTransaction

StockBalance

InventoryLineExpiry

InventoryLineSerialNumber

RequestInventoryMapping

**توضیح**

Serial به دلیل تعداد زیاد در جدول جداگانه است:

InventoryLineSerial

ولی Batch مستقیماً در Line قرار دارد.

**66\. دلیل تفاوت Batch و Serial**

Batch:

1 Line

-

1 BatchId

-

Quantity

مثلاً:

Item A / Batch B001 / Qty 100

Serial:

1 Line

-

20 Serial

مثلاً:

Item A / Qty 20

├── SN001

├── SN002

├── ...

└── SN020

بنابراین Batch باعث انفجار تعداد Lineها نمی‌شود.

**67\. APIهای کلیدی پیشنهادی**

InventoryDocument

\-------------------------

Create

Get

Update

Delete

Confirm

GetAvailableStock

Batch

\-------------------------

Create

Get

Search

Validate

Serial

\-------------------------

GetAvailable

Allocate

Release

InventoryClosing

\-------------------------

Close

Rollback

GetCurrentClosing

GetClosingSnapshot

**68\. قواعد Transactional**

ثبت سند انبار باید Atomic باشد.

مثلاً در خروج Serial Controlled:

Create Document

-

Create Lines

-

Allocate Serials

-

Validate Stock

-

Confirm Document

یا همه موفق شوند یا هیچ‌کدام ثبت نهایی نشوند.

**69\. نکته مهم برای Codex**

در پیاده‌سازی نباید منطق موجودی در چند فرم مختلف تکرار شود.

مثلاً:

Sales Issue

Consumption

Project Issue

Supplier Return

همگی باید از Serviceهای مشترک برای:

Stock Validation

Batch Validation

Serial Validation

Location Validation

Closing Validation

استفاده کنند.

اما **UI فرم‌ها می‌تواند تخصصی و جداگانه باشد.**

**70\. اصل نهایی طراحی UI**

ما در UI بین این دو موضوع تفکیک داریم:

**فرم تخصصی عملیات**

برای هر عملیات اصلی.

**Component مشترک**

برای بخش‌های تکرارشونده مثل:

- انتخاب کالا
- انتخاب Batch
- انتخاب Location
- انتخاب Serial
- انتخاب Request
- نمایش موجودی

بنابراین فرم‌ها مستقل هستند ولی منطق مشترک دارند.

**71\. Summary نهایی**

معماری مورد توافق:

Source of Truth

↓

Inventory Documents

Current Stock

↓

Closing Snapshot

-

Documents After Closing

و عمداً نداریم:

InventoryTransaction

StockBalance

Batch:

Master مستقل

-

BatchId در InventoryLine

Serial:

Master مستقل

-

InventoryLineSerial

Expiry:

فقط در Batch

Request:

یک فرم

-

سه RequestType

Inventory Reference:

در Line

BaseType:

در Header

Posted:

ندارد

Closing:

Snapshot موجودی

Rollback:

درخواست تاریخ جدید

-

محاسبه مجدد Closing تا تاریخ جدید

و مهم‌ترین Business Rule:

DocumentDate <= LastClosingDate

↓

Create = ممنوع

Update = ممنوع

Delete = ممنوع