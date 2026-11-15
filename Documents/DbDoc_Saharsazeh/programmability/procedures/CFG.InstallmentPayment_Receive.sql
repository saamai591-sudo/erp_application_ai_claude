
CREATE proc [CFG].[InstallmentPayment_Receive]

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
		rr.ReceiveReceiptID,
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
	join fin.ReceiveSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.ReceiveReceipt rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID
	join fin.ReceivedCash rc on rs.ReceivedCashID = rc.ReceivedCashID

	union all

		select
		rr.ReceiveReceiptID,
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
	join fin.ReceiveSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.ReceiveReceipt rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID
	join fin.ReceivedCheqe rq on rs.ReceivedCheqeID = rq.ReceivedCheqeID

	union all

		select
		rr.ReceiveReceiptID,
			rr.Number,
			CFG.GetCLRSaturnDate(rr.[Date], @DateFormat  , 0, @DateType) as ReceiveDate,
			'واریز' Type,
			rb.Number DocNumber,
			CFG.GetCLRSaturnDate(rb.[Date], @DateFormat  , 0, @DateType) as DocDate,
			rs.Amount DocAmount,
			I.Number InstallmentNumber,
			CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
			I.Amount

	from cfg.InstallmentPaymentItem I 
	join fin.ReceiveSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.ReceiveReceipt rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID
	join fin.ReceivedBankDraft rb on rs.ReceivedBankDraftID = rb.ReceivedBankDraftID
