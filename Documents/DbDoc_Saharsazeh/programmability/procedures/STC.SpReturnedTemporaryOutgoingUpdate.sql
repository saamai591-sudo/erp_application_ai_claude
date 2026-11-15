CREATE   PROC [STC].[SpReturnedTemporaryOutgoingUpdate] 
    @ReturnedTemporaryOutgoingID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @StockID int,
    @DlID bigint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [STC].[ReturnedTemporaryOutgoing]
				where [ReturnedTemporaryOutgoingID] = @ReturnedTemporaryOutgoingID)
	RAISERROR('Version mismatch...', 16 , 10)
	
	DECLARE @StartNum  INT = NULL,
			@EndNum    INT = NULL,
			@Stock	   bit = 0,
			@ResetType bit = 0,
			@DocumentNumID int,						
			@OutgoingID int,
			@Message NVARCHAR(MAX)			
			
	SELECT @StartNum = StartNum,
		   @EndNum = EndNum,
		   @DocumentNumID =DocumentNumID 
	FROM   CFG.DocumentNum 
	WHERE  DocumentNumTypeID = 51
		   AND FinancialPeriodID = @FinancialPeriodID
	   
	If Exists (select 1 from cfg.DocumentNumResetNumberBase 
	where DocumentNumID=@DocumentNumID and DocumentNumResetNumberBaseTypeID=3)
	Begin
		Set @Stock = 1
	End
		
	IF (@Number = 0 OR @Number IS NULL)
	BEGIN
		SET @Number = ISNULL((SELECT MAX(Number) + 1 FROM   [STC].[ReturnedTemporaryOutgoing]
								WHERE  FinancialPeriodID = @FinancialPeriodID and 
								(@Stock = 0 OR StockID = @StockID)) ,@StartNum)
	End
	ELSE
	BEGIN
	IF (Exists (SELECT 1 FROM [STC].[ReturnedTemporaryOutgoing] 
			WHERE FinancialPeriodID = @FinancialPeriodID 
				AND ReturnedTemporaryOutgoingID <> @ReturnedTemporaryOutgoingID
				AND (@Stock = 0 OR StockID = @StockID)
				AND Number = @Number)) 
            
        BEGIN
			SELECT @Message = 'NumberIsDuplicate'
			RAISERROR(@Message,16,12)
        END            
	END
            
	IF (@Number >= @StartNum AND (@EndNum IS NULL OR @Number <= @EndNum))
	BEGIN

		set @Version = @Version +1 

		UPDATE [STC].[ReturnedTemporaryOutgoing]
		SET    [FinancialPeriodID] = @FinancialPeriodID, [Number] = @Number, [Date] = @Date, [StockID] = @StockID, [DlID] = @DlID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [ReturnedTemporaryOutgoingID] = @ReturnedTemporaryOutgoingID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] , 
				[Number]
        FROM   [STC].[ReturnedTemporaryOutgoing]
		WHERE  [ReturnedTemporaryOutgoingID] = @ReturnedTemporaryOutgoingID	
		-- End Return Select <- do not remove
	END
	ELSE
		BEGIN
			SELECT @Message = 'InvalidNumberRange'
			RAISERROR(@Message,16,12)
		END
END
