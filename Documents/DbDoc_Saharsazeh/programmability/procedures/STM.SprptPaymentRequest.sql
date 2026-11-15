
--------------------------------------------------------
CREATE      PROC [STM].SprptPaymentRequest

@ID NVARCHAR(MAX)
--WITH ENCRYPTION
AS

CREATE TABLE #Ids
(id INT)

insert into #Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

DECLARE @CustomeFields NVARCHAR(max),
		@CustomeFieldSelect NVARCHAR(max),
		@query NVARCHAR(MAX),
		@UserID                    INT,
		@DateType                  VARCHAR(10),
		@DateFormat                VARCHAR(10),
		@Culture                   VARCHAR(10),
		@CultureNo VARCHAR(10),
		@PurchaseContract NVARCHAR(100) 

SET @Culture = CFG.GetuserCulture()

SELECT @PurchaseContract = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'PurchaseDocumentBases'
	   AND L.Item = 'PurchaseContract'
	   AND LV.Culture = @Culture;

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
	
SELECT @CustomeFields = STUFF(
		   (
			   SELECT DISTINCT ',' + QUOTENAME(Fieldname)
			   FROM   cfg.EntityCustomeField
			   WHERE  EntityName = 'PaymentRequest'
					  FOR XML PATH(''), TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   )

IF (@CustomeFields IS NULL)
	SET @CustomeFields = '[NoCustomeField]' 

SELECT @CustomeFieldSelect = STUFF(
		   (
			   SELECT DISTINCT ',CustomEntities.' + QUOTENAME(Fieldname) + ' As cf_' + Fieldname
			   FROM   cfg.EntityCustomeField
			   WHERE  EntityName = 'PaymentRequest'
					  FOR XML PATH(''), TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   )

IF (@CustomeFieldSelect IS NULL)
	SET @CustomeFieldSelect = '[NoCustomeField]' 

	select VoucherID,PrevoucherID
	into #VoucherPrevoucher
	from acc.VoucherPrevoucher
	group by VoucherID,PrevoucherID

	select vp.PrevoucherID,ReferenceNumber,Date
	into #Voucher
	from acc.Voucher v
	join #VoucherPrevoucher vp
		on v.VoucherID = vp.VoucherID

	select  a.PaymentRequestItemID , 
			case 
				when b.ProposalID is not null then b.TotalPrice - b.TotalDiscount + b.TotalDuty + b.TotalTax
				when c.ContractStatementID is not null then c.Vat
				when d.ConfirmStatementID  is not null then d.Net
				when e.PurchaseInvoiceID is not null then e.TotalPrice - e.TotalDiscount + e.TotalDuty + e.TotalTax
				when f.ReturnInvoiceID is not null then f.TotalPrice + f.TotalDuty + f.TotalTax
				when g.ConfirmStatementItemID is not null then g.Deduction
				when h.ContractID is not null then h.Net
				when i.PurchaseContractID is not null then i.TotalPrice - i.TotalDiscount + i.TotalDuty + i.TotalTax
			else a.Amount end BaseAmount,
			v.ReferenceNumber,
			CFG.GetCLRSaturnDate(v.Date, @DateFormat   , 0,  @DateType) VoucherDate,
	case a.basedocumenttype 
	when  5 then 'ارزش افزوده صورت وضعیت شماره ' + 
				cast (c.ContractStatementNumber as varchar(50)) + 
				' قرارداد ' + cast (c.ContractNumber as varchar(50))
	when  4 then 'خالص صورت وضعیت شماره ' + cast (d.ContractStatementNumber as varchar(50)) +
				' قرارداد ' + cast (d.ContractNumber as varchar(50))
	when  2 then 'فاکتور خرید شماره ' + 
				case when e.InvoiceNumber is not null then cast (e.InvoiceNumber as varchar(50)) else cast (e.Number as varchar(50)) end
	when  3 then 'برگشت فروش'
	when  6 then case when @CultureNo = 1 then adt.title else adt.title2 end + ' '+
				 case when g.ConfirmStatementID is not null then ' صورت وضعیت شماره' +
																cast (cs2.Number as varchar(50)) +
																' قرارداد ' +
																Contract.Number 
															 else 'فاکتور شماره ' +
																isnull(e1.InvoiceNumber,cast(e1.number as varchar(50)))
																end				
	when  7 then 'قرارداد شماره ' + cast (h.ContractNumber as varchar(50))
	when  8 then 'استعلام قیمت'
	when  9 then @PurchaseContract
	when 10 then 'تنخواه'
	when 11 then 'خالص فاکتور خرید'
	when 12 then 'ارزش افزوده فاکتور خرید'
	when 13 then 'کسور فاکتور خرید'
	when 1 then 'بدون مبنا'
	end basedocumenttype
	into #BaseInfo
	FROM REQ.PaymentRequestitem a
	left join vnd.Proposal b
		on a.BaseDocumentType = 8 and a.BaseDocumentID = b.ProposalID
	left join [CNT].[vwContractStatementRemain] c
		on a.BaseDocumentType = 5 and a.BaseDocumentID = c.ContractStatementID
	left join [CNT].[vwConfirmStatementRemain] d
		on a.BaseDocumentType = 4 and a.BaseDocumentID = d.ConfirmStatementID	
	left join vnd.PurchaseInvoice e
		on a.BaseDocumentType = 2 and a.BaseDocumentID = e.PurchaseInvoiceID
	left join vnd.ReturnInvoice f
		on a.BaseDocumentType = 3 and a.BaseDocumentID = f.ReturnInvoiceID
	left join CNT.ConfirmStatementItem g
		on a.BaseDocumentType = 6 and a.BaseDocumentID = g.ConfirmStatementItemID
	left join cnt.AdditionDeductionType adt
		on adt.AdditionDeductionTypeID = g.AdditionDeductionTypeID
	left join CNT.ConfirmStatement cs
		on g.ConfirmStatementID = cs.ConfirmStatementID
	left join vnd.PurchaseInvoice e1
		on g.PurchaseInvoiceID = e1.PurchaseInvoiceID
	left join CNT.Contract 
		on Contract.ContractID = cs.ContractID
	left join CNT.ContractStatement cs2
		on cs2.ContractStatementID = cs.ContractStatementID
	left join [CNT].[vwContractRemain] h
		on a.BaseDocumentType = 7 and a.BaseDocumentID = h.ContractID
	left join vnd.PurchaseContract i
		on a.BaseDocumentType = 9 and a.BaseDocumentID = i.PurchaseContractID
	left join #Voucher v
		on (a.BaseDocumentType = 5 and c.prevoucherid = v.PrevoucherID)
		or
		   (a.BaseDocumentType = 4 and d.prevoucherid = v.PrevoucherID)
		or
		   (a.BaseDocumentType = 2 and e.prevoucherid = v.PrevoucherID)
		or
		   (a.BaseDocumentType = 3 and f.prevoucherid = v.PrevoucherID)
		or
		   (a.BaseDocumentType = 6 and ((g.ConfirmStatementID is not null and cs.prevoucherid = v.PrevoucherID) or (g.PurchaseInvoiceID is not null and e1.PreVoucherID = v.PrevoucherID )))

	where  a.PaymentRequestID in (select id from #Ids)

if exists(
			   SELECT *
			   FROM   cfg.EntityCustomeField
			   WHERE  EntityName = 'PaymentRequest'
			   and FieldName = 'CurrencyRate'
)
begin
SET @query = N'
SELECT isnull(rial.Amount,0) + (isnull(othercur.Amount,0) * isnull(CustomEntities.CurrencyRate,1)) Amount,
 case when '+@CultureNo+' = 1 then pa.Title + isnull('' ''+pa.LastName,'''') else pa.Title2 + isnull('' ''+pa.LastName2,'''') end  PartyName,
			 case when '+@CultureNo+' = 1 then ou.title else ou.title2 end OrganizationTitle,
			  case when '+@CultureNo+' = 1 then a.Description else a.Description2 end Description,
			  case when '+@CultureNo+' = 1 then i.Description else i.Description2 end ItemDescription,
			  cfg.GetSaturnDate(a.Date,0) Date,
			  case when '+@CultureNo+' = 1 then us.Name else us.Name2 end Name,
			  case when '+@CultureNo+' = 1 then cur.title else cur.title2 end CurrencyTitle,
			  a.PaymentRequestID,
			  a.Number,
			  case when '+@CultureNo+' = 1 then ou.title else ou.title2 end Requester,
			  case when '+@CultureNo+' = 1 then f.title else f.title2 end FinancialPeriod,
	' + @CustomeFieldSelect + ',
	case when i.currencyid = -1 then 1 else   CustomEntities.CurrencyRate end CurrencyRate,
	i.Amount ItemAmount,
	case when i.currencyid = -1 then i.amount else  i.amount * CustomEntities.CurrencyRate end ItemAmountRial,
	i.RowIndex,#BaseInfo.BaseAmount,
	#BaseInfo.BaseAmount * isnull(CustomEntities.CurrencyRate,1) BaseAmountInBaseCurrency,
	#BaseInfo.ReferenceNumber,
	#BaseInfo.VoucherDate,
	#BaseInfo.basedocumenttype,
	i.PartyID

FROM REQ.PaymentRequest a
join REQ.PaymentRequestitem i on a.PaymentRequestid = i.PaymentRequestid
join #BaseInfo on #BaseInfo.PaymentRequestItemID = i.PaymentRequestItemID
join cfg.FinancialPeriod f on f.FinancialPeriodID = a.FinancialPeriodID
JOIN CFG.Party pa ON pa.PartyID=i.PartyID
join cfg.Currency cur on i.currencyid=cur.currencyid
join cfg.OrganizationUnit ou on ou.OrganizationUnitID = a.OrganizationUnitID
JOIN cfg.[user] US ON [Us].UserID = a.Creator
left join 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecf.LookupDataItemID is not null then case when '+@CultureNo+' = 1 then ld.title else ld.title2 end 
	 when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType + 
	''') else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
left JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
 left JOIN cfg.LookupDataItem ld on ld.LookupDataItemID = ecf.LookupDataItemID
WHERE ecfd.EntityName = ''PaymentRequest''
)x
pivot 
(
	 max(Value)
	for Fieldname IN (' + @CustomeFields + 
	')
)  piv	
)CustomEntities on CustomEntities.EntityID = a.PaymentRequestID
left join
(
select PaymentRequestid,sum(amount) amount
from req.PaymentRequestItem
where currencyid = -1
group by PaymentRequestid
) Rial on Rial.PaymentRequestid = a.PaymentRequestid
left join
(
select PaymentRequestid,sum(amount) amount
from req.PaymentRequestItem
where currencyid <> -1
group by PaymentRequestid
) othercur on othercur.PaymentRequestid = a.PaymentRequestid

where  a.PaymentRequestID in (select id from #Ids)
'
end
else
begin
SET @query = N'
SELECT isnull(rial.Amount,0) + (isnull(othercur.Amount,0)) Amount,
 case when '+@CultureNo+' = 1 then dl.Title  else dl.Title2  end  PartyName,
 dl.code PartyCode,
			 case when '+@CultureNo+' = 1 then ou.title else ou.title2 end OrganizationTitle,
			  case when '+@CultureNo+' = 1 then a.Description else a.Description2 end Description,
			  case when '+@CultureNo+' = 1 then i.Description else i.Description2 end ItemDescription,
			  cfg.GetSaturnDate(a.Date,0) Date,
			  case when '+@CultureNo+' = 1 then us.Name else us.Name2 end Name,
			  case when '+@CultureNo+' = 1 then cur.title else cur.title2 end CurrencyTitle,
			  a.PaymentRequestID,
			  a.Number,
			  case when '+@CultureNo+' = 1 then ou.title else ou.title2 end Requester,
			  case when '+@CultureNo+' = 1 then f.title else f.title2 end FinancialPeriod,
	' + @CustomeFieldSelect + ',
	1 CurrencyRate,
	i.Amount ItemAmount,
	i.amount  ItemAmountRial,
	i.RowIndex,#BaseInfo.BaseAmount,
	#BaseInfo.BaseAmount  BaseAmountInBaseCurrency,
	#BaseInfo.ReferenceNumber,
	#BaseInfo.VoucherDate,
	#BaseInfo.basedocumenttype,
	i.PartyID,
	pa.NationalID,
	pacc.IBAN,
	Bank.Title Bank

FROM REQ.PaymentRequest a
join REQ.PaymentRequestitem i on a.PaymentRequestid = i.PaymentRequestid
left join cfg.partyaccount pacc on pacc.partyaccountid = i.partyaccountid
left join cfg.Bank on Bank.BankID = pacc.BankID
join #BaseInfo on #BaseInfo.PaymentRequestItemID = i.PaymentRequestItemID
join cfg.FinancialPeriod f on f.FinancialPeriodID = a.FinancialPeriodID
JOIN CFG.Party pa ON pa.PartyID=i.PartyID
join acc.dl on dl.dlid = pa.dlid
join cfg.Currency cur on i.currencyid=cur.currencyid
join cfg.OrganizationUnit ou on ou.OrganizationUnitID = a.OrganizationUnitID
JOIN cfg.[user] US ON [Us].UserID = a.Creator
left join 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecf.LookupDataItemID is not null then case when '+@CultureNo+' = 1 then ld.title else ld.title2 end
	 when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType + 
	''') else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
left JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
left JOIN cfg.LookupDataItem ld on ld.LookupDataItemID = ecf.LookupDataItemID
WHERE ecfd.EntityName = ''PaymentRequest''
)x
pivot 
(
	 max(Value)
	for Fieldname IN (' + @CustomeFields + 
	')
)  piv	
)CustomEntities on CustomEntities.EntityID = a.PaymentRequestID
left join
(
select PaymentRequestid,sum(amount) amount
from req.PaymentRequestItem
where currencyid = -1
group by PaymentRequestid
) Rial on Rial.PaymentRequestid = a.PaymentRequestid
left join
(
select PaymentRequestid,sum(amount) amount
from req.PaymentRequestItem
where currencyid <> -1
group by PaymentRequestid
) othercur on othercur.PaymentRequestid = a.PaymentRequestid

where  a.PaymentRequestID in (select id from #Ids)
'
end

EXEC(@query)
