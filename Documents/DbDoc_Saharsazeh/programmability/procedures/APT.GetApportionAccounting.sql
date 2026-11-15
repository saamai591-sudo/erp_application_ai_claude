
CREATE PROCEDURE [APT].[GetApportionAccounting]
	@id int
AS
BEGIN

	if object_id('tempdb..#dates') is not null
		drop table #dates
		
	select p.EndDate
	into #dates
	from APT.ApportionPeriodCalculation c
	join APT.ApportionPeriod p on c.ApportionPeriodID = p.ApportionPeriodID

	
	select a.ApportionAccountingID,
           a.Date,
           a.PortionerGroupID,
           a.PortionedToGroupID,
           a.SlType,
           a.SlID,
           a.Version,
           a.Creator,
           a.CreationDate,
		   cast(case when exists(select * from #dates d where d.EndDate >= a.Date) then 1 
		             else 0
		        end as bit) as HasCalculation
	from APT.ApportionAccounting a
	where a.ApportionAccountingID = @id

	if object_id('tempdb..#dates') is not null
		drop table #dates

END
