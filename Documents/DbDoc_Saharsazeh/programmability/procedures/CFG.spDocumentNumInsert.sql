
---------------------------------------------------------
CREATE   PROC [CFG].[spDocumentNumInsert] 
    @DocumentNumTypeID smallint,
    @StartNum int,
    @EndNum int,
    @CanNumManually bit,
    @FinancialPeriodID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [CFG].[DocumentNum] ([DocumentNumTypeID], [StartNum], [EndNum], [CanNumManually], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @DocumentNumTypeID, @StartNum, @EndNum, @CanNumManually, @FinancialPeriodID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [DocumentNumID], [Version]
	FROM   [CFG].[DocumentNum]
	WHERE  [DocumentNumID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
