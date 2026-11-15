------------------------------------- START #8413
CREATE   PROCEDURE FIN.SpRptFinance_BankAccountFlow
(
    @FromDate DATE = null,
    @ToDate DATE = null,
    @SelectedBankAccount NVARCHAR(50)
)
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @FirstInventory          NVARCHAR(25),
	        @Receive                 NVARCHAR(25),
	        @CashToBank              NVARCHAR(25),
	        @CashFromBank            NVARCHAR(25),
	        @Payment                 NVARCHAR(25),
	        @BankDraft               NVARCHAR(25),
	        @TodayCheqe              NVARCHAR(25),
	        @Outgoing                NVARCHAR(25),
	        @TransferToBank          NVARCHAR(25),
	        @PaymentCheqeCashing     NVARCHAR(25),
	        @Submit                  NVARCHAR(25),
	        @Voucher                 NVARCHAR(25),
	        @PreVoucher              NVARCHAR(25),
	        @Initial                 NVARCHAR(25),
			@Culture				 NVARCHAR(5),
			@CultureNo tinyint,
			@DateType                  VARCHAR(10),
			@DateFormat                VARCHAR(10),
			@UserID                    INT,
			@GuarantyCashFromBank  NVARCHAR(25),
			@RecallDayCheque  NVARCHAR(25)
	    
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

	SELECT @FirstInventory = lsv.[Value]
	FROM   cfg.LocalizationSQLMessage ls
	        JOIN cfg.LocalizationSQLMessageValue lsv
	            ON  lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
	WHERE  ls.SQLMessageCode = 'FirstInventory'
	        AND lsv.Culture = @Culture
	    
	SELECT @Receive = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'ReceivePromissoryCommitmentState'
	        AND le.Item = 'Receive'
	        AND lev.Culture = @Culture
	    
	SELECT @CashToBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInReceive'
	        AND le.Item = 'CashToBank'
	        AND lev.Culture = @Culture
	    
	SELECT @CashFromBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInReceive'
	        AND le.Item = 'CashFromBank'
	        AND lev.Culture = @Culture
	    
	SELECT @Payment = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PaymentCheqeCommitmentState'
	        AND le.Item = 'Payment'
	        AND lev.Culture = @Culture
	    
	SELECT @BankDraft = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PaymentMethod'
	        AND le.Item = 'BankDraft'
	        AND lev.Culture = @Culture
	    
	SELECT @TodayCheqe = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInPayment'
	        AND le.Item = 'TodayCheqe'
	        AND lev.Culture = @Culture
	    
	SELECT @Outgoing = lev.[Value]
	FROM   cfg.LocalizeEnum le
			JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
			AND le.Item = 'Outgoing'
			AND lev.Culture = @Culture
	    
	SELECT @TransferToBank = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Others'
	        AND le.Item = 'TransferToBank'
	        AND lev.Culture = @Culture
	    
	SELECT @PaymentCheqeCashing = lev.[Value]
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Others'
	        AND le.Item = 'PaymentCheqeCashing'
	        AND lev.Culture = @Culture
	    
	SELECT @Submit = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'Statuses'
	        AND le.Item = 'Submit'
	        AND lev.Culture = @Culture
	    
	SELECT @Voucher = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PreVoucherStatuses'
	        AND le.Item = 'Voucher'
	        AND lev.Culture = @Culture
	    
	SELECT @PreVoucher = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PreVoucherStatuses'
	        AND le.Item = 'PreVoucher'
	        AND lev.Culture = @Culture
	    
	SELECT @Initial = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StatusOfReceipt'
	        AND le.Item = 'Initial'
	        AND lev.Culture = @Culture

	SELECT @GuarantyCashFromBank = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'GuarantyState'
	        AND le.Item = 'CashFromBank'
	        AND lev.Culture = @Culture

	SELECT @RecallDayCheque = lev.Value
	FROM   cfg.LocalizeEnum le
	        JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'CheqeStateInReceive'
	        AND le.Item = 'DrawBack'
	        AND lev.Culture = @Culture


	CREATE TABLE #ReportTemp
	(
	    RowID BIGINT NOT null,
	    Operation NVARCHAR(50) NULL,
	    DocName NVARCHAR(50),
	    DocCode INT,
	    HederID INT,
	    BankAccountID INT,
	    BankAccountCode VARCHAR(100) NULL,
	    BankAccountTitle NVARCHAR(256) NULL,
	    [date] DATE NULL,
	    HederNumber INT NULL,
	    Number NVARCHAR(100) NULL,
	    Amount DECIMAL(30, 4) NULL,
		Deposit DECIMAL(30,4) NULL,
        Withdrawal DECIMAL(30,4) NULL,
	    BranchCode INT NULL,
	    BranchTitle NVARCHAR(250) NULL,
	    PartyCode VARCHAR(100) NULL,
	    PartyTitle NVARCHAR(250) NULL,
	    RemainInLine DECIMAL(30, 4) NULL,
		ReferenceNumber int,
		VoucherDate Date
	)
	    
	DECLARE @IndexName VARCHAR(255)
	SELECT @IndexName = CFG.getTempTableName(0)
	DECLARE @IndexQuery NVARCHAR(MAX)
	SET @IndexQuery = 'ALTER TABLE #ReportTemp
			            ADD CONSTRAINT ['+ @IndexName +'] PRIMARY KEY CLUSTERED([RowID] ASC)WITH (
							PAD_INDEX = OFF,
							STATISTICS_NORECOMPUTE = OFF,
							IGNORE_DUP_KEY = OFF,
							ALLOW_ROW_LOCKS = ON,
							ALLOW_PAGE_LOCKS = ON
						) ON [PRIMARY]'
	    
	EXEC (@IndexQuery)

	SELECT a.BankAccountID,
	       SUM(a.Amount) Amount
	INTO #BeginningInventory
	FROM [FIN].[vwbankaccount_Detail] a
	WHERE [Date] < @FromDate 
	
	GROUP BY BankAccountID


	INSERT INTO #ReportTemp
	select 1,
	 	   NULL,
		   @FirstInventory,
		   0,
		   0,
		   a.BankAccountID,
		   dl.code,
		   dl.Title,
		   NULL,
		   NULL,
		   NULL,
		   a.Amount,
		   CASE WHEN a.Amount > 0 THEN a.Amount ELSE 0 END,
			CASE WHEN a.Amount < 0 THEN ABS(a.Amount) ELSE 0 END,  
		   NULL,
		   NULL,
		   NULL,
		   NULL,
		   null,
		   NULL,
		   null
	from #BeginningInventory a
	join cfg.BankAccount b on b.BankAccountID = a.BankAccountID
	join acc.dl on dl.dlid = b.DlID
	WHERE a.BankAccountID = @SelectedBankAccount 

	select * into #VWVoucherPrevoucher
	from acc.VWVoucherPrevoucher
	where Date >=@FromDate

	option (Recompile)
		 

	INSERT INTO #ReportTemp
	select ROW_NUMBER() OVER(ORDER BY a.[date], DocCode, HederNumber) + 1,
		   case when a.Amount > 0 then @Receive 
		        when a.Amount < 0 then @Payment
				else null end,
		   case a.DocCode when 1 then @Outgoing
						  when 2 then @CashToBank
						  when 3 then @CashFromBank
						  when 4 then @TransferToBank
						  when 5 then @BankDraft
						  when 6 then @TodayCheqe
						  when 7 then @PaymentCheqeCashing
						  when 8 then @GuarantyCashFromBank
						  when 9 then @RecallDayCheque
						  when 10 then @Outgoing end,
		   a.DocCode,
		   a.HederID,
		   a.BankAccountID,
		   dl.code,
		   case when @CultureNo = 1 then dl.Title
	            when @CultureNo = 2 then dl.Title2
	       end,
		   a.[date],
		   a.HederNumber,
		   a.Number,
		   a.Amount,
		   CASE WHEN a.Amount > 0 THEN a.Amount ELSE 0 END,
           CASE WHEN a.Amount < 0 THEN ABS(a.Amount) ELSE 0 END,
		   BR.Code,
		   case when @CultureNo = 1 then BR.Title
	            when @CultureNo = 2 then BR.Title2
	       end,
		   dl2.code,
		   case when @CultureNo = 1 then dl2.Title
	            when @CultureNo = 2 then dl2.Title2
	       end,
		   null ,
		   vp.ReferenceNumber,
		   vp.Date VoucherDate
	from [FIN].[vwbankaccount_Detail] a
	left join #VWVoucherPrevoucher vp on a.PrevoucherID = vp.PrevoucherID
	join cfg.BankAccount b on b.BankAccountID = a.BankAccountID
	join acc.dl on dl.dlid = b.DlID
	join cfg.Branch br on br.BranchID = a.BranchID
	left join cfg.Party p on p.PartyID = a.PartyID
	left join acc.dl dl2 on dl2.dlid = p.dlid
	WHERE a.BankAccountID = @SelectedBankAccount and
		a.[Date] BETWEEN @FromDate AND @ToDate 


	SET @IndexQuery = 'DECLARE @RemainInLine DECIMAL(30, 4)
	                    SET @RemainInLine = 0
	    
		                UPDATE #ReportTemp
	                    SET  @RemainInLine = @RemainInLine + ISNULL(Amount, 0),
							RemainInLine = @RemainInLine
	                    FROM #ReportTemp
	                    WITH (INDEX(['+ @IndexName +']))'

	EXEC (@IndexQuery)	
	    

	SELECT r.RowID,
	       r.Operation,
	       r.DocName,
	       r.DocCode,
	       r.HederID,
	       r.BankAccountID,
	       r.BankAccountCode,
	       r.BankAccountTitle,		   
		   r.[Date],
		   CFG.GetCLRSaturnDate(r.[Date], @DateFormat  , 0,  @DateType ) Date_Date,
	       r.HederNumber,
	       r.Number,
	       r.Amount,
		   r.Deposit,
		   r.Withdrawal,
	       r.BranchCode,
	       r.BranchTitle,
	       r.PartyCode,
	       r.PartyTitle,
	       r.RemainInLine,
		   r.ReferenceNumber,
		   CFG.GetCLRSaturnDate(r.VoucherDate, @DateFormat  , 0,  @DateType ) VoucherDate
	FROM #ReportTemp r 
	   
END

