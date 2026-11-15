CREATE     PROC [NOC].[spAnalysingUpdate]
    @AnalysingID int,
    @ReportagePeriodID int,
	@CalculatePeriodID int,
    @Type tinyint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if exists(select * from NOC.Analysing where ReportagePeriodID = @ReportagePeriodID and Type = @Type and
	          AnalysingID <> @AnalysingID)
	begin
		raiserror('PeriodAndTypeDup',16,12)
		return 
	end

	if @Version=(Select [Version] from NOC.Analysing
	where AnalysingID = @AnalysingID)
	begin	

		set @Version = @Version +1 

		UPDATE NOC.Analysing
		SET    ReportagePeriodID = @ReportagePeriodID, 
			   CalculatePeriodID = @CalculatePeriodID,
			   [Type] = @Type, 			  
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  AnalysingID = @AnalysingID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   NOC.Analysing
		WHERE  AnalysingID = @AnalysingID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
