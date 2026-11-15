
CREATE    PROC [PRM].[spProductionPlanningUpdate]
    @ProductionPlanningID int,  	
	@Number int,
    @Date date,
	@StartDate datetime,
	@EndDate datetime,
	@ProductionProcessID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@State tinyint
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	
	declare @PreVersion int,
	        @FinancialPeriodID int,
			@StartNum INT = NULL,
			@EndNum INT = NULL,			
			@DocumentNumID int,
			@Message NVARCHAR(MAX)

	select @PreVersion = [Version],
	       @FinancialPeriodID = FinancialPeriodID
	from PRM.ProductionPlanning 
	where ProductionPlanningID = @ProductionPlanningID

	if (@Version = @PreVersion)
	begin	

		set @Version = @Version +1 

		SELECT @StartNum = StartNum,
			   @EndNum = EndNum,
			   @DocumentNumID =DocumentNumID 
		FROM   cfg.DocumentNum 
		WHERE  DocumentNumTypeID = (SELECT DocumentNumTypeID FROM CFG.DocumentNumType
		WHERE  EngName = 'ProductionPlanning')
				AND FinancialPeriodID = @FinancialPeriodID

	IF(@Number = 0 OR @Number IS NULL)
	SET @Number =ISNULL((SELECT MAX(Number) + 1
                      FROM PRM.ProductionPlanning
                WHERE  FinancialPeriodID = @FinancialPeriodID 
					     ),@StartNum)
	
	
   
      IF (
       @Number >= @StartNum
       AND (@EndNum IS NULL OR @Number <= @EndNum)
   )
	BEGIN	

		UPDATE PRM.ProductionPlanning
		SET    Number = @Number,
		       Date = @Date, 
			   StartDate = @StartDate,
			   EndDate = @EndDate,
			   ProductionProcessID = @ProductionProcessID,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version,
			   State = @State 
		WHERE  ProductionPlanningID = @ProductionPlanningID
	
		-- Begin Return Select <- do not remove
		SELECT  Number,[Version]
		FROM   PRM.ProductionPlanning
		WHERE  ProductionPlanningID= @ProductionPlanningID
		-- End Return Select <- do not remove	
		
	END
	ELSE
	BEGIN
		RAISERROR('InvalidNumberRange',16,12)
		return
	END

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
