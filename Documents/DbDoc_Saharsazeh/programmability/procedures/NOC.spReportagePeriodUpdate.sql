CREATE     PROC [NOC].[spReportagePeriodUpdate]
    @ReportagePeriodID int,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@StartDate date,
	@EndDate date,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from NOC.ReportagePeriod
	where ReportagePeriodID = @ReportagePeriodID)
	begin	

		set @Version = @Version +1 

		UPDATE NOC.ReportagePeriod
		SET    Title = @Title, 
			   Title2 = @Title2, 
			   StartDate = @StartDate,
			   EndDate = @EndDate,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ReportagePeriodID = @ReportagePeriodID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   NOC.ReportagePeriod
		WHERE  ReportagePeriodID = @ReportagePeriodID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
