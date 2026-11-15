------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spReturnedOutgoingUpdate] 
    @ReturnedOutgoingID int,
    @FinancialPeriodID int,
    @StockDocumentTypeBaseEntityID INT ,
    @StockID int,
    @DlDeliverID bigint,
    @StockDeliverID int,
    @Number int,
    @Date date,
    @ReturnStockReceiptID int,
    @PreVoucherID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @TotalPrice decimal(30,4)
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 


	DECLARE @PrePrevoucher INT,
			@preVersion INT

	Select @preVersion = [Version],
		   @PrePrevoucher = PreVoucherID	
	from [STC].[ReturnedOutgoing]
	where [ReturnedOutgoingID] = @ReturnedOutgoingID
	
	if @Version <> @preVersion
	or @PrePrevoucher is not null	
	RAISERROR('Version mismatch...', 16 , 10)

DECLARE @StartNum  INT = NULL,
			@EndNum    INT = NULL,
			@Stock	   bit = 0,
			@StockDocumentTypeID INT,
			@ResetType bit = 0,
			@DocumentNumID int,
			@Message NVARCHAR(MAX)
	
	SELECT @StartNum = StartNum,
		   @EndNum = EndNum,
		   @DocumentNumID =DocumentNumID 
	FROM   CFG.DocumentNum 
	WHERE  DocumentNumTypeID = 19
		   AND FinancialPeriodID = @FinancialPeriodID

	SELECT  @StockDocumentTypeID = StockDocumentTypeID
    FROM    stc.StockDocumentTypeBaseEntity sdtb
	where sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
			
	If Exists (select * from cfg.DocumentNumResetNumberBase 
	where DocumentNumID=@DocumentNumID and DocumentNumResetNumberBaseTypeID=3)
	Begin
	Set @Stock = 1
	End
	
	If Exists (select * from cfg.DocumentNumResetNumberBase 
	where DocumentNumID=@DocumentNumID and DocumentNumResetNumberBaseTypeID=2)
	Begin
	Set @ResetType = 1
	End
	
	           
	IF (@Number = 0 OR @Number IS NULL)--شماره گذاري سيستمي يا اگر دستي بود ولي مقدار را وارد نکرده بود
	BEGIN
		SET @Number = ISNULL(
            (	SELECT MAX(Number) + 1
                FROM  [STC].[ReturnedOutgoing] ro
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID

                WHERE  FinancialPeriodID = @FinancialPeriodID and (@Stock=0 OR StockID=@StockID)
                and (@ResetType=0 OR [StockDocumentTypeID]=@StockDocumentTypeID)
            )
            ,@StartNum)
    END
	ELSE
	BEGIN
		SELECT @Message = 'NumberIsDuplicate'
		
		
		
		IF (Exists (SELECT * FROM [STC].[ReturnedOutgoing] ro
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					 WHERE FinancialPeriodID = @FinancialPeriodID 
					 AND (@Stock=0 OR StockID=@StockID)
					 AND (@ResetType=0 OR [StockDocumentTypeID]=@StockDocumentTypeID) 
					 AND Number = @Number
					 AND ReturnedOutgoingID <> @ReturnedOutgoingID) )
			RAISERROR(@Message,16,12)
			--RAISERROR('شماره حواله برگشتی تکراری است', 16, 12)
	END
	
      IF (
       @Number >= @StartNum
       AND (@EndNum IS NULL OR @Number <= @EndNum)
   )
	BEGIN
	
		BEGIN TRAN

		UPDATE [STC].[ReturnedOutgoing]
		SET     [StockDocumentTypeBaseEntityID] = @StockDocumentTypeBaseEntityID, 
				[StockID] = @StockID, 
				[DlDeliverID] = @DlDeliverID, 
				[StockDeliverID] = @StockDeliverID, 
				[Number] = @Number, 
				[Date] = @Date, 
				[ReturnStockReceiptID] = @ReturnStockReceiptID, 
				[Version] = @Version + 1,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate , 
				[TotalPrice] = @TotalPrice
		WHERE  [ReturnedOutgoingID] = @ReturnedOutgoingID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] 
        FROM   [STC].[ReturnedOutgoing]
		WHERE  [ReturnedOutgoingID] = @ReturnedOutgoingID	
		-- End Return Select <- do not remove
	
		COMMIT
		END
	ELSE		
	BEGIN
		
		RAISERROR('InvalidNumberRange',16,12)
		
		--RAISERROR('شماره در محدوده ي مجاز نمي باشد', 16, 12)
	END



