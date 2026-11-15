

CREATE   PROCEDURE [APT].[ApportionReview_Flow]
	@CurrentFinancialPeriodID int,
	@SelectedApportionPeriods varchar(max) = null,
	@SelectedPortioners varchar(max) = null,
	@SelectedPortionedTos varchar(max) = null
AS
BEGIN

	DECLARE @Culture varchar(25),
		    @CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	if object_id('tempdb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos

	create table #FinalResult
	(
		ID int identity(1,1) not null,
	    ApportionPeriod nvarchar(256) not null,
		PortionerGroup nvarchar(256) not null,
		PortionedToGroup nvarchar(256) not null,
		PortionerCode int not null,
		PortionerTitle nvarchar(256) not null,
		PortionedToCode int not null,
		PortionedToTitle nvarchar(256) not null,
		Degree int not null,
		ApportionAmount decimal(30, 4) not null
	)


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionerItemID
	INTO #Selected_Portioners
	FROM CFG.Split(@SelectedPortioners,'|')


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionedToID
	INTO #Selected_PortionedTos
	FROM CFG.Split(@SelectedPortionedTos,'|')

	
	insert into #FinalResult 
	select case when @CultureNo = 1 then p.Title
	            when @CultureNo = 2 then p.Title2
	       end,		   	       
		   case when @CultureNo = 1 then g.Title
	            when @CultureNo = 2 then g.Title2
	       end,
		   case when @CultureNo = 1 then g2.Title
	            when @CultureNo = 2 then g2.Title2
	       end,
		   po2.Code,		   
		   case when @CultureNo = 1 then po2.Title
	            when @CultureNo = 2 then po2.Title2
	       end,
		   t.Code,
		   case when @CultureNo = 1 then t.Title
	            when @CultureNo = 2 then t.Title2
	       end,
		   i.Degree,
		   i.Amount

	from APT.ApportionCalculationItem i
	join APT.ApportionCalculation c on i.ApportionCalculationID = c.ApportionCalculationID
	join APT.ApportionPeriodCalculation a on c.ApportionPeriodCalculationID = a.ApportionPeriodCalculationID
	join APT.ApportionPeriod p on a.ApportionPeriodID = p.ApportionPeriodID
	join APT.PortionerItem po on c.PortionerItemID = po.PortionerItemID
	join APT.Portioner po2 on po.PortionerID = po2.PortionerID
	join APT.ApportionGroup g on po2.ApportionGroupID = g.ApportionGroupID
	join APT.PortionedTo t on i.PortionedToID = t.PortionedToID
	join APT.ApportionGroup g2 on t.ApportionGroupID = g2.ApportionGroupID
	where p.FinancialPeriodID = @CurrentFinancialPeriodID and
		(@SelectedApportionPeriods is null or
		 a.ApportionPeriodID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedApportionPeriods))) and
	     (@SelectedPortioners is null or
		 (c.ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_Portioners) and
		  c.PortionerItemID in (select PortionerItemID from #Selected_Portioners))) and
		(@SelectedPortionedTos is null or
		 (c.ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_PortionedTos) and
		  i.PortionedToID in (select PortionedToID from #Selected_PortionedTos)))
	order by c.ApportionPeriodCalculationID,i.ApportionCalculationItemID,i.Degree	


	select * from #FinalResult

	if object_id('tempdb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos

END

