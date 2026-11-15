

CREATE   PROCEDURE [APT].[ApportionReview_ApportionPeriod]
	@CurrentFinancialPeriodID int,
	@SelectedPortioners varchar(max) = null,
	@SelectedPortionedTos varchar(max) = null
AS
BEGIN

	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),				        
	        @Culture VARCHAR(10),
			@CultureNo tinyint		
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD'

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos
	
	if object_id('tempdb..#PortionerTMP') is not null
		drop table #PortionerTMP

	if object_id('tempdb..#PortionedToTMP') is not null
		drop table #PortionedToTMP


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionerItemID
	INTO #Selected_Portioners
	FROM CFG.Split(@SelectedPortioners,'|')


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionedToID
	INTO #Selected_PortionedTos
	FROM CFG.Split(@SelectedPortionedTos,'|')


	select ApportionPeriodCalculationID,
	       sum(Amount) PortionerAmount
	into #PortionerTMP
	from APT.ApportionCalculation 
	where (@SelectedPortioners is null or
		 (ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_Portioners) and
		  PortionerItemID in (select PortionerItemID from #Selected_Portioners)))
	group by ApportionPeriodCalculationID


	select c.ApportionPeriodCalculationID,
	       sum(i.Amount) PortionedToAmount
	into #PortionedToTMP
	from APT.ApportionCalculationItem i 
	join APT.ApportionCalculation c on i.ApportionCalculationID = c.ApportionCalculationID
	where (@SelectedPortionedTos is null or
		 (c.ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_PortionedTos) and
		  i.PortionedToID in (select PortionedToID from #Selected_PortionedTos))) 		  
	group by c.ApportionPeriodCalculationID


	select c.ApportionPeriodID,	       
		   case when @CultureNo = 1 then p.Title
	            when @CultureNo = 2 then p.Title2
	       end as Title,
	       p.EndDate AS [Date],
		   CFG.GetCLRSaturnDate(p.EndDate, @DateFormat, 0, @DateType) Date_Date,
		   t.PortionerAmount,
		   t2.PortionedToAmount

	from APT.ApportionPeriodCalculation c
	join APT.ApportionPeriod p on c.ApportionPeriodID = p.ApportionPeriodID
	join #PortionerTMP t on c.ApportionPeriodCalculationID = t.ApportionPeriodCalculationID
	join #PortionedToTMP t2 on c.ApportionPeriodCalculationID = t2.ApportionPeriodCalculationID
	where p.FinancialPeriodID = @CurrentFinancialPeriodID 
		

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos

	if object_id('tempdb..#PortionerTMP') is not null
		drop table #PortionerTMP

	if object_id('tempdb..#PortionedToTMP') is not null
		drop table #PortionedToTMP

END

