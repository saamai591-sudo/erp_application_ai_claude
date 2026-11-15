
CREATE   PROCEDURE REQ.GetPaymentRequests
(
	@PartyId bigint,
    @Type tinyint 
)
--WITH ENCRYPTION
AS
	DECLARE @UserID int,
	        @Culture varchar(25),
			@DateType tinyint,
	        @DateFormat varchar(10),
			@Submit nvarchar(10),
			@Confirmed nvarchar(10),
			@Rejected nvarchar(10),
			@Normal nvarchar(10),
			@Guaranteed nvarchar(10),
			@ConfigValue nvarchar(10),
			@CultureNo tinyint
				
	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

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

	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @Culture

	SELECT @Confirmed = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Confirmed'
	       AND LV.Culture = @Culture

	SELECT @Rejected = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'CheckExamItemStates'
	       AND L.Item = 'Rejected'
	       AND LV.Culture = @Culture

	SELECT @Normal = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PersonelStatus'
	       AND L.Item = 'Normal'
	       AND LV.Culture = @Culture

	SELECT @Guaranteed = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PaymentRequestTypes'
	       AND L.Item = 'Guaranteed'
	       AND LV.Culture = @Culture

	select @ConfigValue = ConfigValue from CFG.[Configuration] where ConfigKey = 'PaymentRequestNeedConfirm'
	set @ConfigValue = LOWER(@ConfigValue)

	SELECT pri.PaymentRequestID,
			pri.CurrencyID,
			SUM(pri.Amount)  Amount
			into #T2
	FROM   req.PaymentRequestItem  AS pri
	GROUP BY
			pri.PaymentRequestID,pri.CurrencyID

	SELECT pr.PaymentRequestID,ps.CurrencyID,SUM(ps.Amount) Amount
	into #T3
		FROM fin.PaymentSubject AS ps
	JOIN fin.PaymentReceipt AS pr ON pr.PaymentReceiptID = ps.PaymentReceiptID
	WHERE pr.PaymentRequestID IS NOT NULL
	and PartyID = @PartyId AND pr.[Status]<>2
	GROUP BY pr.PaymentRequestID,ps.CurrencyID

	SELECT a.PaymentRequestID,a.CurrencyID,a.Amount,ISNULL(paid.Amount,0) done,a.Amount-ISNULL(paid.Amount,0) AS non
	into #T
	from #T2 a
	left join #T3 paid
	ON a.PaymentRequestID=paid.PaymentRequestID and a.CurrencyID=paid.CurrencyID

	select r.PaymentRequestID,
           r.Type,
		   case when r.Type = 1 then @Normal
		        when r.Type = 2 then @Guaranteed
		   end as TypeString,
		   r.Number,
           r.Date,
		   CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) PersianDate,
		   case when r.Status = 1 then @Submit
		        when r.Status = 2 then @Confirmed
				when r.Status = 3 then @Rejected
			end as StatusString,
			 null as ContractID,
			 r.Description,
			 r.Description2
			 into #T1
	from REQ.PaymentRequest r
	JOIN (SELECT DISTINCT ri.PaymentRequestID, ri.PartyID FROM REQ.PaymentRequestItem ri) rii
		ON r.PaymentRequestID = rii.PaymentRequestID
	WHERE rii.PartyID = @PartyId 
	      and r.Type = @Type 
		  and ((@ConfigValue = 'true' and r.Status = 2) or (@ConfigValue <> 'true' and r.Status = 1))
		 
	select a.*
	from #T1 a
	join #T b  on a.PaymentRequestID = b.PaymentRequestID
	where  b.non>0

