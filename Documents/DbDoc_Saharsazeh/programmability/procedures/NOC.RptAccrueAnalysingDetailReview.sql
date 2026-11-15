
CREATE   PROCEDURE NOC.RptAccrueAnalysingDetailReview
(
    @SelectedSlTreeLevel     VARCHAR(MAX) = NULL,
    @SelectedParties     VARCHAR(MAX) = NULL,
	@SelectedContracts     VARCHAR(MAX) = NULL,
	@FromPeriod int,
	@ToPeriod int,
	@Analysing bit,
	@CurrencyExchange bit,
	@Modification bit
)

--WITH ENCRYPTION
WITH RECOMPILE
AS

	DECLARE @UserID            INT,
	        @Culture           VARCHAR(25),
	        @CultureNo         VARCHAR(25),
			@StartDate date,
			@EndDate Date,
			@DateType TINYINT,
            @DateFormat VARCHAR(10),
			@TableName  NVARCHAR(MAX),
			@Query nvarchar(max),
			@CurrencyReport int

	SET @TableName = CFG.getTempTableName(1);
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = CFG.GetuserCulture() 

	select @CurrencyReport = ConfigValue
	from noc.NIOCSetting
	where ConfigKey = 'CurrencyReport'

	select @StartDate = StartDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @FromPeriod

	select @EndDate = EndDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @ToPeriod

	SELECT @CultureNo =ISNULL( CultureNo,1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture

	SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID
	
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'


	create table #SlParents
	(
	SlID int,
	Parent int
	)

	select slid,acc.[SlParentString](a.slid) ParentsString into #S from acc.sl a

	declare @MaxOrder int,
			@intFlag INT = 1

	select @MaxOrder = max(LevelOrder)
	from acc.SlTreeLevel

	WHILE (@intFlag <= @MaxOrder)
	BEGIN
		insert into #SlParents
		select slid,[CFG].[GetStringPart](ParentsString,@intFlag) from #S
		SET @intFlag = @intFlag + 1
	END


	select SlID
	into #FilteredSlID
	from 
	(
	select a.SlID
	from #SlParents a
	join
	(
	select value
	from cfg.R_FnCommaStr2Table(@SelectedSlTreeLevel)
	) b  on a.Parent = b.value
	)A
	union all
	select value
	from cfg.R_FnCommaStr2Table(@SelectedSlTreeLevel)



	select  a.*, 
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			d.[Order] ReportagePeriodOrder
	into #AllVoucherItem
	 from noc.AccrueAnalysing a
	 join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	 join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	where a.Status = 1
	and d.StartDate >= @StartDate and d.EndDate <= @EndDate


	select  a.*,
			b.VoucherID,
			b.SlID
	into #VoucherItem
	from #AllVoucherItem a
	join acc.VoucherItem b
		on a.VoucherItemID = b.VoucherItemID
	left join #FilteredSlID 
		on b.SlID = #FilteredSlID.SlID
	where 
	(
	@SelectedSlTreeLevel is null
	or
	#FilteredSlID.SlID is not null
	)


	declare @Columns nvarchar(max),
	        @AlterQuery nvarchar(max),
			@SelectQuery nvarchar(max),
			@JoinQuery  nvarchar(max),
			@Param nvarchar(max)


			
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(al.AccountLevelID)
	               FROM   acc.AccountLevel al
				   WHERE AccountLevelTypeID = 1 
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )	

	
	CREATE TABLE #AccountLevelVoucherItem
	(
	VoucherItemID INT
	)

	SELECT @AlterQuery = STUFF(
	           (
	               SELECT DISTINCT ' alter table #AccountLevelVoucherItem add ' 
	                      +
	                      QUOTENAME(AccountLevelID) + ' int'
	               FROM   acc.AccountLevel
	               WHERE  AccountLevelTypeID = 1
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )

	exec (@AlterQuery)	
	
	set @Query = N'
    INSERT INTO #AccountLevelVoucherItem
	SELECT * FROM
	(select 
		VoucherItemID,
		AccountLevelID,
		DLID
	 from  acc.AccountLevelVoucherItem a
	 where dlid is not null
	)x
	PIVOT(
			MAX(DLID)
			FOR AccountLevelID IN (' + @Columns +
	')) vial
		'

	exec (@Query)

	SELECT @SelectQuery = STUFF(
	           (
	               SELECT			',d' + CAST(AccountLevelID AS VARCHAR(10)) 
	                                +
	                                '.Code AS ALDL' + CAST(AccountLevelID AS VARCHAR(10)) 
	                                +
	                                '_CODE,d' + CAST(AccountLevelID AS VARCHAR(10)) 
	                                +
	                                case when @CultureNo = 1 then '.Title' else '.Title2' end +' AS ALDL' + CAST(AccountLevelID AS VARCHAR(10)) 
	                                + '_TITLE,d'+ CAST(AccountLevelID AS VARCHAR(10)) 
	                                +
	                                '.DLID AS ALDL' + CAST(AccountLevelID AS VARCHAR(10)) 
									+'_ID'
	                  FROM acc.AccountLevel 
					  WHERE AccountLevelTypeID = 1 
	                  FOR XML PATH(''),
	               TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       )


	SELECT @JoinQuery = STUFF(
	           (
	               SELECT DISTINCT ' Left Join acc.dl d' + CAST(AccountLevelID AS VARCHAR(10))
	                      +
	                      ' on d' + CAST(AccountLevelID AS VARCHAR(10)) +
	                      '.DlID = D.' +
	                      QUOTENAME(AccountLevelID)
	               FROM   acc.AccountLevel
	               WHERE  AccountLevelTypeID = 1
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )

	declare @CreateTable nvarchar(max)
	SELECT @CreateTable = STUFF(
	           (
	               SELECT ',ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_CODE VARCHAR(50),' +
						  'ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_TITLE NVARCHAR(max),'+
						  'ALDL' + CAST(AccountLevelID AS VARCHAR(10)) + '_ID NVARCHAR(max)'
	                  FROM acc.AccountLevel 
					  WHERE AccountLevelTypeID = 1 
	                  FOR XML PATH(''),
	               TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )


	SET @Query = N'
			create table '+@TableName+'
				(   VoucherItemID int,
					VoucherID int,			
					ReferenceNumber int,
					VoucherDate varchar(12),
					SlCode varchar(50),
					SlTitle nvarchar(512),
					'+@CreateTable+',
					BaseCurrencyDebit decimal(36,10),
					BaseCurrencyCredit decimal(36,10),
					CurrencyRate decimal(36,10),
					Debit decimal(36,10),
					Credit decimal(36,10),
					ReportagePeriod varchar(512),
					ReportagePeriodOrder int not null
					)'
	exec(@Query)


		select  SlID,
				case when @CultureNo = 1 then sl.Title else sl.Title2 end SlTitle,
				acc.SlFullCode(SlID) SlCode
		into #Sl
		from acc.sl 


	if @Analysing = 1
	begin

	SET @Query = N'
	insert into '+@TableName+'
	Select  a.VoucherItemID,
	        c.VoucherID,			
			C.ReferenceNumber,
			CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) ,
			SlCode,
			SlTitle 
			'+@SelectQuery+',
			a.BaseCurrencyDebit,
			a.BaseCurrencyCredit,
			ReportCurrencyRate,
			a.ReportCurrencyDebit,
			a.ReportCurrencyCredit,
			ReportagePeriod,
			ReportagePeriodOrder
	from #VoucherItem a
	join acc.Voucher c
		on a.VoucherID = c.VoucherID
	join #Sl sl 
		on sl.SlID = a.SlID
	LEFT JOIN #AccountLevelVoucherItem D
		ON D.VoucherItemID = a.VoucherItemID
		'+@JoinQuery

		EXECUTE sp_executeSQL     
				@Query,
				N'@DateFormat VARCHAR(10),  @DateType TINYINT, @CurrencyReport int',
				@DateFormat = @DateFormat,
				@DateType = @DateType,
				@CurrencyReport = @CurrencyReport

	end


	if @Modification = 1
	begin

	select  c.SlID,
			v.VoucherID,
			v.Date,
			v.ReferenceNumber,
			vi.Credit Debit      ,
			vi.Debit  Credit     ,
			ReportCurrencyRate,
			c.VoucherItemID,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			c.ModificationID,
			d.[Order] ReportagePeriodOrder,
			case when vi.CurrencyID = @CurrencyReport then vi.CurrencyDebit else round(vi.Credit  / ReportCurrencyRate,2) end ReportCurrencyDebit,
			case when vi.CurrencyID = @CurrencyReport then vi.CurrencyCredit else round(vi.Debit / ReportCurrencyRate,2) end ReportCurrencyCredit
	  into #Modification
	 from noc.Modification c
	join acc.VoucherItem vi
		on vi.VoucherItemID = c.VoucherItemID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	left join
		(
		select PrevoucherID,VoucherID
		from acc.VoucherPrevoucher
		group by PrevoucherID,VoucherID
		)vp
		on vp.PrevoucherID = c.PreVoucherID
	left join acc.Voucher v
		on v.VoucherID = vp.VoucherID

	where  d.StartDate >= @StartDate and d.EndDate <= @EndDate

	SET @Query = N'
	insert into '+@TableName+'
	Select  null,
	        m.VoucherID,			
			m.ReferenceNumber,
			CFG.GetCLRSaturnDate(m.Date, @DateFormat, 0, @DateType) VoucherDate,
			SlCode,
			SlTitle
			'+@SelectQuery+',
			m.debit  BaseCurrencyDebit,
			m.Credit BaseCurrencyCredit,
			ReportCurrencyRate CurrencyRate,
			ReportCurrencyDebit,
			ReportCurrencyCredit,
			ReportagePeriod,
			ReportagePeriodOrder
	from #Modification m
	join #Sl sl 
		on sl.SlID = m.SlID
	left join #FilteredSlID 
	on m.SlID = #FilteredSlID.SlID
	LEFT JOIN #AccountLevelVoucherItem D
		ON D.VoucherItemID = m.VoucherItemID
	'+@JoinQuery+'
	where 
	(@SelectedSlTreeLevel is null
	or
	#FilteredSlID.SlID is not null
	)'

		EXECUTE sp_executeSQL     
				@Query,
				N'@SelectedSlTreeLevel varchar(256),@DateFormat VARCHAR(10),  @DateType TINYINT',
				@SelectedSlTreeLevel = @SelectedSlTreeLevel,
				@DateFormat = @DateFormat,
				@DateType = @DateType


	SET @Query = N'
	insert into '+@TableName+'
	Select  null,
	        m.VoucherID,			
			m.ReferenceNumber,
			CFG.GetCLRSaturnDate(m.Date,@DateFormat, 0, @DateType) VoucherDate,
			SlCode,
			SlTitle
			'+@SelectQuery+',
			BaseCurrencyDebitAccrue BaseCurrencyDebit,
			BaseCurrencyCreditAccrue BaseCurrencyCredit,
			ReportCurrencyRate ,
			ReportCurrencyDebitAccrue  Debit,
			ReportCurrencyCreditAccrue  Credit,
			ReportagePeriod,
			ReportagePeriodOrder
	from #Modification m
	join  noc.ModifiedTopic  mt
		on mt.ModificationID = m.ModificationID
	left join #FilteredSlID 
		on mt.SlID = #FilteredSlID.SlID
	join #Sl sl 
		on sl.SlID = mt.SlID
	LEFT JOIN #AccountLevelVoucherItem D
		ON D.VoucherItemID = m.VoucherItemID
	'+@JoinQuery+'
	where 
	(@SelectedSlTreeLevel is null
	or
	#FilteredSlID.SlID is not null
	)
	and ToBeReported = 1
	'

		EXECUTE sp_executeSQL     
				@Query,
				N'@SelectedSlTreeLevel varchar(256),@DateFormat VARCHAR(10),  @DateType TINYINT',
				@SelectedSlTreeLevel = @SelectedSlTreeLevel,
				@DateFormat = @DateFormat,
				@DateType = @DateType

	end
	if @CurrencyExchange = 1
	begin

	select ROW_NUMBER() over(order by CurrencyExchangeID) ID,* 
	into #Accrue_Temp
	from (
	select  a.slid,
			0     BaseCurrencyDebit,
			0    BaseCurrencyCredit,
			case when a.Value > 0 then Value else 0 end  Debit,
			case when a.Value < 0 then abs(Value) else 0 end  Credit,
			e.DlID,
			CurrencyExchangeID,
			a.AccrueVoucherID,
			d.EndDate,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			d.[Order] ReportagePeriodOrder,
			Contract.DLID ContractDLID
	 from noc.CurrencyExchange a
	join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	left join cfg.Party e
		on e.PartyID = a.PartyID
	left join cnt.Contract
		on Contract.Contractid = a.ContractID
	left join #FilteredSlID 
		on a.SlID = #FilteredSlID.SlID
	where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
	and
	(
	@SelectedSlTreeLevel is null
	or
	#FilteredSlID.SlID is not null
	)

	union all

	select  ExchangeGainLoss,
			0     BaseCurrencyDebit,
			0    BaseCurrencyCredit,
			case when a.Value < 0 then abs(Value) else 0 end  Debit,
			case when a.Value > 0 then Value else 0 end  Credit,
			e.DlID,
			CurrencyExchangeID,
			a.AccrueVoucherID,
			d.EndDate,
			case when @CultureNo = 1 then d.Title else d.Title2 end ReportagePeriod,
			d.[Order] ReportagePeriodOrder,
			Contract.DLID ContractDLID
	 from noc.CurrencyExchange a
	join noc.Analysing c
		on c.AnalysingID = a.AnalysingID
	join noc.ReportagePeriod d
		on d.ReportagePeriodID = c.ReportagePeriodID
	left join cfg.Party e
		on e.PartyID = a.PartyID
	left join cnt.Contract
		on Contract.Contractid = a.ContractID
	left join #FilteredSlID 
		on a.ExchangeGainLoss = #FilteredSlID.SlID
	where  d.StartDate >= @StartDate and d.EndDate <= @EndDate
	and ExchangeGainLoss is not null
	and
	(
	@SelectedSlTreeLevel is null
	or
	#FilteredSlID.SlID is not null
	)
	)A
	


	SET @Query = N'
	select a.*,v.ReferenceNumber,p.*
	into #Accrue_Temp2 
	from #Accrue_Temp a
	left join acc.voucher v on v.voucherid = a.AccrueVoucherID
	left join (
		Select  b.id TempID,b.dlid,als.AccountLevelID
		from #Accrue_Temp b	
		join acc.accountlevelsl als on b.slid = als.slid 
		join acc.dltype t on t.dltypeid = als.dltypeid
		where t.code = 103
		union all
		Select  b.id TempID,b.ContractDLID,als.AccountLevelID
		from #Accrue_Temp b	
		join acc.accountlevelsl als on b.slid = als.slid 
		join acc.dltype t on t.dltypeid = als.dltypeid
		where t.code = 111
		)	x
		pivot
		(MAX(DLID)
				FOR AccountLevelID IN (' + @Columns +')
				)p on a.ID = p.TempID

	insert into '+@TableName+'
	Select  null,
	        null,			
			ReferenceNumber,
			CFG.GetCLRSaturnDate(EndDate, @DateFormat, 0, @DateType) VoucherDate,
			SlCode,
			SlTitle
			'+@SelectQuery+',
			d.BaseCurrencyDebit,
			d.BaseCurrencyCredit,
			null,
			d.Debit,
			d.Credit,
			ReportagePeriod,
			ReportagePeriodOrder
	from #Accrue_Temp2 d
	join #Sl sl 
		on sl.SlID = d.SlID	
	'+ @JoinQuery

	
		EXECUTE sp_executeSQL     
				@Query,
				N'@DateFormat VARCHAR(10),  @DateType TINYINT',
				@DateFormat = @DateFormat,
				@DateType = @DateType
	end


	if @SelectedParties is null and @SelectedContracts is null
	exec(N'Select *,ROW_NUMBER() over(order by VoucherItemID ) RowID from '+@TableName+N' order by ReportagePeriodOrder,ReferenceNumber')
	else
	begin
	
		create table #SelectedPartyDl (DlId int)
		insert into #SelectedPartyDl
		select value  
		from CFG.R_FnCommaStr2Table(@SelectedParties)

		create table #SelectedContractDl (DlId int)
		insert into #SelectedContractDl
		select value 
		from CFG.R_FnCommaStr2Table(@SelectedContracts)

		declare @PartyClause nvarchar(max)
		declare @ContractClause nvarchar(max)


		if @SelectedParties is not null
		begin
			SELECT @PartyClause = '(' + STUFF(
					(
						SELECT DISTINCT ' or ALDL' + CAST(AccountLevelID AS VARCHAR(10))+'_ID in (select DlId from #SelectedPartyDl)' 
						FROM   acc.AccountLevel al
						WHERE AccountLevelTypeID = 1 
								FOR XML PATH(''),
								TYPE
					).value('.', 'NVARCHAR(MAX)'),1,3,'') + ') and '
		END
		ELSE
		BEGIN
			SELECT @PartyClause = ' 1=1 and '
		END

		if @SelectedContracts is not null
		begin
			SELECT @ContractClause ='(' + STUFF(
					(
						SELECT DISTINCT ' or ALDL' + CAST(AccountLevelID AS VARCHAR(10))+'_ID in (select DlId from #SelectedContractDl)' 
						FROM   acc.AccountLevel al
						WHERE AccountLevelTypeID = 1 
								FOR XML PATH(''),
								TYPE
					).value('.', 'NVARCHAR(MAX)'),1,3,'') + ')'
		END
		ELSE
		BEGIN
			SELECT @ContractClause = ' 1=1 '
		END

		SET @Query = N'Select *,ROW_NUMBER() over(order by VoucherItemID ) RowID 
		from '+@TableName+N' 
		where '+@PartyClause+@ContractClause+'
		order by ReportagePeriodOrder,ReferenceNumber'

		print @Query
			EXECUTE sp_executeSQL     
					@Query,
					N'@SelectedParties NVARCHAR(max)',
					@SelectedParties = @SelectedParties

		end				
