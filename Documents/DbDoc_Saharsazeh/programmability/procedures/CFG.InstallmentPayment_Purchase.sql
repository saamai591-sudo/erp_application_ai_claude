
CREATE proc [CFG].[InstallmentPayment_Purchase]

--with encryption

as



DECLARE	@Culture varchar(10),
		@userid int,
		@DateType TINYINT,
		@DateFormat VARCHAR(10)

 set  @userid = cfg.GetuserID()

set @Culture = cfg.GetuserCulture()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL

	SET @DATEFORMAT = 'YY/MM/DD'

	select
			I.InstallmentPaymentItemID,
			SUM(ISNULL(
			DATEDIFF(day,i.date,
								case when rs.PaymentCashID is not null then rr.Date
									 when rs.PaymentCheqeID is not null then rq.Date
									 when rs.PaymentBankDraftID is not null then rb.Date
									 when rs.PaymentOtherCheqeID is not null then rr.date
									 else null end
					)
				  ,0)
			*rs.Amount) AS RRatio,
			SUM(rs.Amount) AS SumRSAmount
			into #RRatio
	from cfg.InstallmentPaymentItem I 
	join fin.PaymentSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.PaymentReceipt rr on rr.PaymentReceiptID = rs.PaymentReceiptID
	left join fin.PaymentCash rc on rs.PaymentCashID = rc.PaymentCashID
	left join fin.PaymentCheqe rq on rs.PaymentCheqeID = rq.PaymentCheqeID
	left join fin.PaymentBankDraft rb on rs.PaymentBankDraftID = rb.PaymentBankDraftID
	left join fin.PaymentOtherCheqe po on po.PaymentOtherCheqeID = rs.PaymentOtherCheqeID
	group by I.InstallmentPaymentItemID

Select 
I.InstallmentPaymentItemID,
	v.Number,
	CFG.GetCLRSaturnDate(v.[Date], @DateFormat  , 0, @DateType) as InvoiceDate,
	d.Title PartyName,
	d.Code PartyCode,
	v.TotalNetPrice,
	I.Number InstallmentNumber,
	CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
	I.Amount,
	round((isnull(r.RRatio,0) + (case when I.date > getdate() then 0
							else DATEDIFF(DAY,I.date,getdate()) end
							*
						(I.Amount - isnull(r.SumRSAmount,0))))/I.Amount ,0) Ratio

 from cfg.InstallmentPayment H
join cfg.InstallmentPaymentItem I on I.InstallmentPaymentID = H.InstallmentPaymentID
left join #RRatio r on r.InstallmentPaymentItemID = I.InstallmentPaymentItemID
join VND.PurchaseInvoice V on v.PurchaseInvoiceID = H.DocumentID
join acc.dl d on d.DLID = v.DlID

where DocumentName = 'VND.PurchaseInvoice'
