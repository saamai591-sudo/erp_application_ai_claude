
CREATE proc [CFG].[InstallmentPayment_Payment]

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
	rr.PaymentReceiptID,
			rr.Number,
			CFG.GetCLRSaturnDate(rr.[Date], @DateFormat  , 0, @DateType) as ReceiveDate,
			'نقد' Type,
			null DocNumber,
			null DocDate,
			rs.Amount DocAmount,
			I.Number InstallmentNumber,
			CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
			I.Amount

	from cfg.InstallmentPaymentItem I 
	join fin.PaymentSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.PaymentReceipt rr on rr.PaymentReceiptID = rs.PaymentReceiptID
	join fin.PaymentCash rc on rs.PaymentCashID = rc.PaymentCashID

	union all

		select
		rr.PaymentReceiptID,
			rr.Number,
			CFG.GetCLRSaturnDate(rr.[Date], @DateFormat  , 0, @DateType) as ReceiveDate,
			'چک' Type,
			rq.Number DocNumber,
			CFG.GetCLRSaturnDate(rq.[Date], @DateFormat  , 0, @DateType) as DocDate,
			rs.Amount DocAmount,
			I.Number InstallmentNumber,
			CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
			I.Amount

	from cfg.InstallmentPaymentItem I 
	join fin.PaymentSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.PaymentReceipt rr on rr.PaymentReceiptID = rs.PaymentReceiptID
	join fin.PaymentCheqe rq on rs.PaymentCheqeID = rq.PaymentCheqeID

	union all

		select
		rr.PaymentReceiptID,
			rr.Number,
			CFG.GetCLRSaturnDate(rr.[Date], @DateFormat  , 0, @DateType) as ReceiveDate,
			'برداشت' Type,
			rb.Number DocNumber,
			CFG.GetCLRSaturnDate(rb.[Date], @DateFormat  , 0, @DateType) as DocDate,
			rs.Amount DocAmount,
			I.Number InstallmentNumber,
			CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
			I.Amount

	from cfg.InstallmentPaymentItem I 
	join fin.PaymentSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.PaymentReceipt rr on rr.PaymentReceiptID = rs.PaymentReceiptID
	join fin.PaymentBankDraft rb on rs.PaymentBankDraftID = rb.PaymentBankDraftID

	union all

		select
		rr.PaymentReceiptID,
			rr.Number,
			CFG.GetCLRSaturnDate(rr.[Date], @DateFormat  , 0, @DateType) as ReceiveDate,
			'خرج چک' Type,
			rc.Number DocNumber,
			CFG.GetCLRSaturnDate(rc.[Date], @DateFormat  , 0, @DateType) as DocDate,
			rs.Amount DocAmount,
			I.Number InstallmentNumber,
			CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
			I.Amount

	from cfg.InstallmentPaymentItem I 
	join fin.PaymentSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.PaymentReceipt rr on rr.PaymentReceiptID = rs.PaymentReceiptID
	join fin.PaymentOtherCheqe rb on rs.PaymentOtherCheqeID = rb.PaymentOtherCheqeID
	join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = rb.ReceivedCheqeID
