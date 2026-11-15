
create   proc [CNT].[GetContractStatementDetailBaseDocuments]
@Type TinyInt,
@PartyID BigInt,
@BranchID int,
@FinancialPeriodID int,
@CurrencyID int

as

DECLARE @UserID        INT,
        @DateType      VARCHAR(10),
        @DateFormat    VARCHAR(10),
        @Culture       VARCHAR(10),
		@CultureNo	   VARCHAR(10),
		@DlID		   BigINt

SET @Culture = CFG.GetuserCulture()

select @CultureNo = CultureNo
from cfg.CultureInfo
where Culture = @Culture

SET @UserID = cfg.GetuserID()

SELECT @DateType = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Type'
       AND us.UserID = @UserID

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                         WHEN 'fa' THEN 0
                         WHEN 'en' THEN 1
                         WHEN 'ar' THEN 2
                    END
	
SELECT @DateFormat = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @UserID
	       
IF @DateFormat IS NULL
    SET @DATEFORMAT = 'YY/MM/DD'
    

select @DlID = DLID
from cfg.Party
where PartyID = @PartyID

if @Type = 1
	select  a.PaymentTypeID DocumentID,
			case when @CultureNo = 1 then a.Title else a.Title2 end Title,
	 		acc.SlFullCode(b.SLID) SlCode,
			case when @CultureNo = 1 then b.Title else b.Title2 end SlTitle,
			0 Amount
	from fin.PaymentType a
	join acc.SL b on a.SLID = b.SlID
	where Type in (9,10,12)


if @Type = 2
	select	a.PurchaseInvoiceID DocumentID,
			N'فاکتور شماره '+
				isnull(a.InvoiceNumber,cast(a.number as varchar(25)))+
				N' به تاریخ '+
				CFG.GetCLRSaturnDate(isnull(a.InvoiceDate,a.Date),@DateFormat,0,@DateType) Title,
			acc.SlFullCode(g.SLID) SlCode,
			case when @CultureNo = 1 then h.Title else h.Title2 end SlTitle,
			a.TotalNetPrice - isnull(PrePayment.Price,0) - isnull(Deduction.Price,0) Amount
	from vnd.PurchaseInvoice a
	left join [CNT].ContractStatementDetail b on b.BaseDocumentType = 2 and b.BaseDocumentID = a.PurchaseInvoiceID
	left join req.PaymentRequestItem c on c.BaseDocumentType = 2 and c.BaseDocumentID =  a.PurchaseInvoiceID
	left join FIN.PaymentSubject d on d.PurchaseInvoiceID =  a.PurchaseInvoiceID
	left join FIN.PettyCashCostItem e on e.PurchaseInvoiceID =  a.PurchaseInvoiceID
	left join CFG.DebitCreditNoteItem f on f.PurchaseInvoiceID =  a.PurchaseInvoiceID
	join vnd.PurchaseType g on g.PurchaseTypeID = a.Type
	join acc.SL h on g.SLID = h.SlID
	left join
	(
	select PurchaseInvoiceID,sum(Deduction) Price
	from cnt.ConfirmStatementItem
	group by PurchaseInvoiceID
	) Deduction on Deduction.PurchaseInvoiceID = a.PurchaseInvoiceID
	left join
	(
	select PurchaseInvoiceID,sum(Price) Price
	from vnd.PurchaseInvoicePrePayment
	group by PurchaseInvoiceID
	) PrePayment on PrePayment.PurchaseInvoiceID = a.PurchaseInvoiceID
	where BaseType <> 3
	and a.DlID = @DlID
	and ContractStatementDetailID is null
	and PaymentRequestItemID is null
	and d.PaymentSubjectID is null
	and e.PettyCashCostItemID is null
	and f.DebitCreditNoteItemID is null
	and a.FinancialPeriodID = @FinancialPeriodID
	and a.BranchID = @BranchID
	and a.CurrencyID = @CurrencyID