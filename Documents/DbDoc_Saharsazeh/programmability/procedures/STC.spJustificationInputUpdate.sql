
------------------------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spJustificationInputUpdate] 
    @JustificationInputID int,
    @StockDocumentTypeBaseEntityID INT ,
    @Number int,
    @Date date,
    @StockID int,
    @DeliverDlID bigint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @FinancialPeriodID INT
    --WITH ENCRYPTION
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [STC].[JustificationInput]
	where [JustificationInputID] = @JustificationInputID)
	begin	
	 DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Stock BIT = 0 ,
        @StockDocumentTypeID INT,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @DocumentNumTypeID INT ,
        @Message NVARCHAR(MAX);
		
    SELECT  @DocumentNumTypeID = DocumentNumTypeID
    FROM    [CFG].[DocumentNumType]
    WHERE   EngName = 'JustificationInput';
 
	SELECT  @StockDocumentTypeID = StockDocumentTypeID
    FROM    stc.StockDocumentTypeBaseEntity sdtb
	where sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
			
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
						  AND JustificationInputID <> @JustificationInputID
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
		set @Version = @Version +1 

		UPDATE [STC].[JustificationInput]
		SET    [StockDocumentTypeBaseEntityID] = @StockDocumentTypeBaseEntityID, [Number] = @Number, [Date] = @Date, [StockID] = @StockID, [DeliverDlID] = @DeliverDlID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [FinancialPeriodID] = @FinancialPeriodID
		WHERE  [JustificationInputID] = @JustificationInputID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] , 
				[Number]
        FROM   [STC].[JustificationInput]
		WHERE  [JustificationInputID] = @JustificationInputID	
		-- End Return Select <- do not remove
	END
END;
