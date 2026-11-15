
------------------------------------- START #8297
create   PROC [HRM].[spGetEmployerShareData]
    @Date date
AS
BEGIN

	create table #result (
		EmployerShareID int  NOT NULL,
		[Date] [date] NOT NULL,
		[Level] [tinyint] NOT NULL,
		[Type] [tinyint] NOT NULL,
		[FoodTypeID] [int] NULL,
		[Amount] [decimal](30, 10) NOT NULL
	)

	declare @EmployerShareID int, @LatestDate date, @LatestLevel tinyint

	select top 1 @EmployerShareID = EmployerShareID,
	             @LatestDate = Date,
				 @LatestLevel = Level
	from HRM.EmployerShare
	where Date <= @Date
	order by EmployerShareID desc, Date desc

	if (@LatestLevel = 2)
	begin
		insert into #result
		select es.EmployerShareID, 
	       es.Date, 
		   es.Level,
		   es.Type,
		   es.FoodTypeID,
		   es.Amount
		from HRM.EmployerShare es	
		where es.EmployerShareID = @EmployerShareID

	end
	else if (@LatestLevel = 1)
	begin
	
		insert into #result
		select es.EmployerShareID, 
	       es.Date, 
		   es.Level,
		   es.Type,
		   es.FoodTypeID,
		   es.Amount
		from HRM.EmployerShare es	
		where es.Date = @LatestDate and es.Level = 1

	end
	select * from #result
end;
