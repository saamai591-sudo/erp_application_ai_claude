CREATE   PROC [PRM].[spProductionOrderInsert]  
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Creator int,
    @CreationDate datetime,
	@Status tinyint =1
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON

	DECLARE @StartNum  INT = NULL,
			@EndNum    INT = NULL,			
			@DocumentNumID int,
			@Message NVARCHAR(MAX)
			
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
		
		INSERT INTO PRM.ProductionOrder (FinancialPeriodID, Number, Date, Creator, CreationDate, LastEditor, LastEditionDate, [Version],[Status])
		SELECT @FinancialPeriodID, @Number, @Date, @Creator, @CreationDate, @Creator, @CreationDate, 0,@Status
	
		-- Begin Return Select <- do not remove
		SELECT ProductionOrderID,[Version], Number,[Status]
		FROM   PRM.ProductionOrder
		WHERE  ProductionOrderID = SCOPE_IDENTITY()
		-- End Return Select <- do not remove           
	END
	ELSE
	BEGIN
		RAISERROR('InvalidNumberRange',16,12)
	END
END
