

CREATE   PROCEDURE [APT].[ApportionReview_PortionedTo]
	@CurrentFinancialPeriodID int,
	@SelectedApportionPeriods varchar(max) = null,
	@SelectedPortioners varchar(max) = null
AS
BEGIN

	DECLARE @Culture varchar(25),
		    @CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	if object_id('temodb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Share') is not null
		drop table #Share

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

	create table #FinalResult
	(
		ID int identity(1,1) not null,
		ApportionPeriodCalculationID int not null,
		PortionedToID int not null,
	    ApportionPeriod nvarchar(256) not null,
		PortionedToGroup nvarchar(256) not null,
		PortionedToCode int not null,
		PortionedToTitle nvarchar(256) not null,
		ShareOfApportion decimal(30, 4) not null
	)


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionerItemID
	INTO #Selected_Portioners
	FROM CFG.Split(@SelectedPortioners,'|')


	select a.PortionedToID,		   
	       b.ApportionPeriodCalculationID,
		   sum(a.Amount) Amount
	into #Share
	from APT.ApportionCalculationItem a
	join APT.ApportionCalculation b on a.ApportionCalculationID = b.ApportionCalculationID	
	join APT.ApportionPeriodCalculation c on b.ApportionPeriodCalculationID = c.ApportionPeriodCalculationID		
	join APT.PortionerItem d on b.PortionerItemID = d.PortionerItemID	
	where (@SelectedPortioners is null or
		   (d.PortionerID in (select s2.PortionerID from #Selected_Portioners s
		                      join APT.PortionerItem s2 on s.PortionerItemID = s2.PortionerItemID) and 
			b.ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_Portioners))) and
		  (@SelectedApportionPeriods is null or
		   c.ApportionPeriodID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedApportionPeriods))) 
	group by a.PortionedToID,b.ApportionPeriodCalculationID
	

	insert into #FinalResult 
	select a.ApportionPeriodCalculationID,
	       a.PortionedToID,		   
		   case when @CultureNo = 1 then c.Title
	            when @CultureNo = 2 then c.Title2
	       end,	       	
		   case when @CultureNo = 1 then e.Title
	            when @CultureNo = 2 then e.Title2
	       end,		   	   
		   d.Code,		   
		   case when @CultureNo = 1 then d.Title
	            when @CultureNo = 2 then d.Title2
	       end,
		   a.Amount
	from #Share a
	join APT.ApportionPeriodCalculation b on a.ApportionPeriodCalculationID = b.ApportionPeriodCalculationID	
	join APT.ApportionPeriod c on b.ApportionPeriodID = c.ApportionPeriodID
	join APT.PortionedTo d on a.PortionedToID = d.PortionedToID
	join APT.ApportionGroup e on d.ApportionGroupID = e.ApportionGroupID		
	where c.FinancialPeriodID = @CurrentFinancialPeriodID 
	order by a.ApportionPeriodCalculationID,a.PortionedToID


	select * from #FinalResult

	if object_id('tempdb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Share') is not null
		drop table #Share

	if object_id('tempdb..#Selected_Portioners') is not null
		drop table #Selected_Portioners

END

