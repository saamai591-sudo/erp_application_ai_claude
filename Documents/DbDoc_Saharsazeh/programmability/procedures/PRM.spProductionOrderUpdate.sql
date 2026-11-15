CREATE   PROC [PRM].[spProductionOrderUpdate]
    @ProductionOrderID int,  	
	@Number int,
    @Date date,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@Status tinyint
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
	from PRM.ProductionOrder 
	where ProductionOrderID = @ProductionOrderID

	if (@Version = @PreVersion)
	begin	

		set @Version = @Version +1 

		SELECT @StartNum = StartNum,
			   @EndNum = EndNum,
			   @DocumentNumID =DocumentNumID 
		FROM   cfg.DocumentNum 
		WHERE  DocumentNumTypeID = (SELECT DocumentNumTypeID FROM CFG.DocumentNumType
		WHERE  EngName = 'ProductionOrder')
				AND FinancialPeriodID = @FinancialPeriodID

	IF(@Number = 0 OR @Number IS NULL)
	SET @Number =ISNULL((SELECT MAX(Number) + 1
                      FROM PRM.ProductionOrder
                WHERE  FinancialPeriodID = @FinancialPeriodID 
					     ),@StartNum)
   
    IF (
       @Number >= @StartNum
       AND (@EndNum IS NULL OR @Number <= @EndNum)
   )
	BEGIN	
		UPDATE PRM.ProductionOrder
		SET    Number = @Number,
		       Date = @Date, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version,
			   [Status]=@Status
		WHERE  ProductionOrderID = @ProductionOrderID
	
		-- Begin Return Select <- do not remove
		SELECT  Number,[Version]
		FROM   PRM.ProductionOrder
		WHERE  ProductionOrderID = @ProductionOrderID
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
