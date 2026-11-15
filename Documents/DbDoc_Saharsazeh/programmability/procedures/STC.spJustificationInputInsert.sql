
------------------------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spJustificationInputInsert] 
    @StockDocumentTypeBaseEntityID INT ,
    @Number int,
    @Date date,
    @StockID int,
    @DeliverDlID bigint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @FinancialPeriodID INT
    --WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	
    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Stock BIT = 0 ,
        @ResetType BIT = 0 ,		
        @StockDocumentTypeID INT,
        @DocumentNumID INT ,
        @DocumentNumTypeID INT ,
        @Message NVARCHAR(MAX);
		
    SELECT  @DocumentNumTypeID = DocumentNumTypeID
    FROM    [CFG].[DocumentNumType]
    WHERE   EngName = 'JustificationInput';

    SELECT  @StockDocumentTypeID = StockDocumentTypeID
    FROM    stc.StockDocumentTypeBaseEntity sdtb
	WHERE sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID

			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = @DocumentNumTypeID
            AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS ( SELECT  1
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 3 )
    BEGIN
        SET @Stock = 1;
    END;
	
    IF ( EXISTS ( SELECT    1
                  FROM      CFG.DocumentNumResetNumberBase
                  WHERE     DocumentNumID = 217
                            AND DocumentNumResetNumberBaseTypeID = 2 ) )
    BEGIN
        SET @ResetType = 1;
    END;

    IF ( @Number = 0
         OR @Number IS NULL
       )
        BEGIN
		
            SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                                   FROM     [STC].[JustificationInput] ji
								   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                                        ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                                   WHERE    FinancialPeriodID = @FinancialPeriodID
                                            AND ( @Stock = 0
                                                  OR StockID = @StockID
                                                )
                                            AND ( @ResetType = 0
                                                  OR sdtb.StockDocumentTypeID = @StockDocumentTypeID
                                                )
                                 ), @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS ( SELECT    1
                          FROM      [STC].[JustificationInput] ji
								   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                                        ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                          WHERE     FinancialPeriodID = @FinancialPeriodID
                                    AND ( @Stock = 0
                                          OR StockID = @StockID
                                        )
                                    AND ( @ResetType = 0
                                          OR sdtb.[StockDocumentTypeID] = @StockDocumentTypeID
                                        )
                                    AND Number = @Number ) )
                BEGIN
                    RAISERROR('NumberIsDuplicate',16,12);
                    RETURN;
                END;
        END;
	
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
    BEGIN
	
		INSERT INTO [STC].[JustificationInput] ([StockDocumentTypeBaseEntityID], [Number], [Date], [StockID], [DeliverDlID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [FinancialPeriodID])
		SELECT @StockDocumentTypeBaseEntityID, @Number, @Date, @StockID, @DeliverDlID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @FinancialPeriodID
	
		-- Begin Return Select <- do not remove
		SELECT [JustificationInputID],
				[Version],
				[Number]
		FROM   [STC].[JustificationInput]
		WHERE  [JustificationInputID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove
	END   
END;
