------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spReturnedOutgoingInsert] 
    @FinancialPeriodID int,
    @StockDocumentTypeBaseEntityID INT ,
    @StockID int,
    @DlDeliverID bigint,
    @StockDeliverID int,
    @Number int,
    @Date date,
    @ReturnStockReceiptID int,
    @PreVoucherID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @TotalPrice decimal(30,4)
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
					
	DECLARE @StartNum  INT = NULL,
			@EndNum    INT = NULL,
			@Stock	   bit = 0,
			@ResetType bit = 0,
		    @StockDocumentTypeID INT,
			@DocumentNumID int,
			@Message NVARCHAR(MAX)

    SELECT  @StockDocumentTypeID = StockDocumentTypeID
    FROM    stc.StockDocumentTypeBaseEntity sdtb
	WHERE sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
				
	SELECT @StartNum = StartNum,
		   @EndNum = EndNum,
		   @DocumentNumID =DocumentNumID 
	FROM   CFG.DocumentNum 
	WHERE  DocumentNumTypeID = 19
		   AND FinancialPeriodID = @FinancialPeriodID

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
		IF (Exists (SELECT * FROM [STC].[ReturnedOutgoing]  ro
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE FinancialPeriodID = @FinancialPeriodID 
		and (@Stock=0 OR StockID=@StockID)
                and (@ResetType=0 OR StockDocumentTypeID=@StockDocumentTypeID) AND Number = @Number)) 
            BEGIN
				RAISERROR( 'NumberIsDuplicate',16,12)
			END
	END
	
      IF (
       @Number >= @StartNum
       AND (@EndNum IS NULL OR @Number <= @EndNum)
   )
	BEGIN
		INSERT INTO [STC].[ReturnedOutgoing] ([FinancialPeriodID], StockDocumentTypeBaseEntityID, [StockID], [DlDeliverID], [StockDeliverID], [Number], [Date], [ReturnStockReceiptID], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[TotalPrice])
		SELECT @FinancialPeriodID, @StockDocumentTypeBaseEntityID, @StockID, @DlDeliverID, @StockDeliverID, @Number, @Date, @ReturnStockReceiptID, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate,@TotalPrice
	
		-- Begin Return Select <- do not remove
		SELECT [ReturnedOutgoingID],  [Version],  [Number]
		FROM   [STC].[ReturnedOutgoing]
		WHERE  [ReturnedOutgoingID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove
	END
	ELSE	
	BEGIN
		RAISERROR('InvalidNumberRange',16,12)
	END
