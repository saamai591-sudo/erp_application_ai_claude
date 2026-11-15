CREATE   PROC [STC].[SpTemporaryOutgoingUpdate] 
    @TemporaryOutgoingID int,
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

	if @Version <> (Select [Version] from [STC].[TemporaryOutgoing]
				where [TemporaryOutgoingID] = @TemporaryOutgoingID)
				begin
		RAISERROR('Version mismatch...', 16 , 10)
		return 0
	end

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
	WHERE  DocumentNumTypeID = 50
		   AND FinancialPeriodID = @FinancialPeriodID
	   
	If Exists (select * from cfg.DocumentNumResetNumberBase 
	where DocumentNumID=@DocumentNumID and DocumentNumResetNumberBaseTypeID=3)
	Begin
		Set @Stock = 1
	End
		
	IF (@Number = 0 OR @Number IS NULL)
		SET @Number = ISNULL((SELECT MAX(Number) + 1 FROM   [STC].[TemporaryOutgoing]
								WHERE  FinancialPeriodID = @FinancialPeriodID and 
								(@Stock=0 OR StockID=@StockID)) ,@StartNum)
	ELSE
	BEGIN
	IF (Exists (SELECT * FROM [STC].[TemporaryOutgoing] WHERE FinancialPeriodID = @FinancialPeriodID 
			AND (@Stock=0 OR StockID = @StockID)
            AND Number = @Number and [TemporaryOutgoingID] <> @TemporaryOutgoingID)) 
            
        BEGIN
			SELECT @Message = 'NumberIsDuplicate'
			
			RAISERROR(@Message,16,12)
		
			--RAISERROR('شماره تکراری است', 16, 12)
        END            
	END
            
	IF (@Number >= @StartNum AND (@EndNum IS NULL OR @Number <= @EndNum))
	BEGIN
	
	set @Version = @Version +1 

		UPDATE [STC].[TemporaryOutgoing]
		SET		[FinancialPeriodID] = @FinancialPeriodID,
				[Number] = @Number, [Date] = @Date, [StockID] = @StockID,
				[DlID] = @DlID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [TemporaryOutgoingID] = @TemporaryOutgoingID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] ,
				[Number]
        FROM   [STC].[TemporaryOutgoing]
		WHERE  [TemporaryOutgoingID] = @TemporaryOutgoingID	
		-- End Return Select <- do not remove
	
	END
	ELSE
		BEGIN
			SELECT @Message = 'InvalidNumberRange'
			RAISERROR(@Message,16,12)
		END	

END
