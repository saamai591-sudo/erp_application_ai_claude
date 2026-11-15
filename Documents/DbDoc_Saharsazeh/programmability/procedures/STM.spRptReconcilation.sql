
Create     PROC STM.spRptReconcilation
(@ReconcilationID INT)
as 
    DECLARE @UserID INT,
            @DateType TINYINT, 
			@DateFormat VARCHAR(10)

	SET @UserID = CFG.GetuserID();

	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @UserID;
	  
    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;
	

	declare @FinancialPeriod int,
			@StartDate date,
			@Date date

	select @FinancialPeriod = financialPeriodID,
		   @Date = date
	from [FIN].[Reconciliation]
	where [ReconciliationID] = @ReconcilationID

	select @StartDate = StartDate
	from cfg.financialPeriod where financialPeriodID = @FinancialPeriod

	create table #BookAmount
	( 
		BankAccountID int,
		Code varchar(50),
		Title nvarchar(500),
		CurrencyID int,	
		CurrencyTitle varchar(50),
		OpeningBalance decimal(30,4),	
		Received decimal(30,4),
		Payment decimal(30,4),
		Amount decimal(30,4),
		AssignToBankCheqeAmount	decimal(30,4),
		TermCheqeAmount	decimal(30,4),
		PaymentOrderAmount 	decimal(36,10),
		PettyCashOpeningBalance decimal(36,10),
		PettyCashReceived decimal(36,10),
		PettyCashPayment decimal(36,10),
		PettyCashAmount decimal(36,10)
	)

	insert into #BookAmount
	exec fin.SpRptFinance_BankAccount @StartDate,@Date

	select  r.ReconciliationID,m.Amount BankAmountInBook,bb.Amount BankBillAmount,r.Date,d.Title,d.Title2,r.Number,
	u.Name CreatorName1,u.Name2 CreatorName2
	into #HeaderInfo
	 from [FIN].[Reconciliation] r
	 join #BookAmount m on m.BankAccountID = r.BankAccountID
	 join fin.BankBill bb on r.BankBillID = bb.BankBillID
	 join cfg.BankAccount ba on r.BankAccountID = ba.BankAccountID
	 join acc.DL d on ba.DlID = d.DLID
	 join cfg.[User] u on r.Creator = u.UserID
	 where r.[ReconciliationID]  = @ReconcilationID

	  select * into #ItemInfo
	  from (
			SELECT rbi.ReconciliationID,case when Deposite>0 then 1 else 2 end  As Type,rbi.Deposite,rbi.Withdraw,cfg.GetCLRSaturnDate(rbi.Date,@DateFormat,@DateType,0) DateString,rbi.Number,rbi.Description
			FROM fin.ReconciledBookItem AS rbi
			where ReconciliationID = @ReconcilationID
			and Passed = 0
			union all
			select rbi.ReconciliationID,case when Deposite>0 then 3 else 4 end ,bbi.Deposite,bbi.Withdraw,cfg.GetCLRSaturnDate(bbi.Date,@DateFormat,@DateType,0) DateString,bbi.Number,bbi.Description from fin.ReconciledBillItem rbi
			join fin.BankBillItem bbi on rbi.BankBillItemID = bbi.BankBillItemID
			where ReconciliationID = @ReconcilationID
			and Passed = 0) a

		select hi.Title,cfg.GetCLRSaturnDate(hi.Date,@DateFormat,@DateType,0) ReconcilationDate,BankAmountInBook,BankBillAmount,
		ii.Type,ii.DateString ItemDate,ii.Number ItemNumber,ii.Deposite,ii.Withdraw,ii.Description,hi.Number ReconcilationNumber
		,hi.CreatorName1
		,hi.CreatorName2
		from #HeaderInfo hi
		left join #ItemInfo ii on hi.ReconciliationID = ii.ReconciliationID
