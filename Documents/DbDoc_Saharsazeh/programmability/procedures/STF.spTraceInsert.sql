CREATE PROC [STF].[spTraceInsert]
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @AccountLevelTypeID SMALLINT,
    @DlTypeID INT,
    @PricingBase BIT,
    @MainMeasureUnitCalculatingBase BIT,
    @TraceOrder INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Alias CHAR(1),
    @OrderView INT,
    @CheckInventory BIT,
    @EffectiveInPricing BIT,
    @IsEffectiveInProduceCost BIT,
    @IsEffectiveInConsumeCost BIT

--WITH ENCRYPTION 
AS
BEGIN

    SET NOCOUNT ON;
    SET XACT_ABORT ON;
	
    INSERT INTO [STF].[Trace]
    (
        [Title],
        [Title2],
        [AccountLevelTypeID],
        [DlTypeID],
        [PricingBase],
        [MainMeasureUnitCalculatingBase],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Alias],
        TraceOrder,
        [OrderView],
        [CheckInventory],
        [EffectiveInPricing],
        [IsEffectiveInProduceCost],
        [IsEffectiveInConsumeCost]
    )
    SELECT @Title,
           @Title2,
           @AccountLevelTypeID,
           @DlTypeID,
           @PricingBase,
           @MainMeasureUnitCalculatingBase,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @Alias,
           @TraceOrder,
           @OrderView,
           @CheckInventory,
           @EffectiveInPricing,
           @IsEffectiveInProduceCost,
           @IsEffectiveInConsumeCost;

    UPDATE Tr
    SET Tr.TraceOrder = T.Rno
    FROM STF.Trace Tr
        INNER JOIN
        (
            SELECT tr.TraceID,
                   ROW_NUMBER() OVER (PARTITION BY CASE
                                                       WHEN tr.AccountLevelTypeID = 1 THEN
                                                           1
                                                       ELSE
                                                           0
                                                   END
                                      ORDER BY tr.TraceID
                                     ) AS Rno
            FROM STF.Trace tr
        ) T
            ON T.TraceID = Tr.TraceID;


    -- Begin Return Select <- do not remove
    SELECT [TraceID],
           [Version],
           [TraceOrder]
    FROM [STF].[Trace]
    WHERE [TraceID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

END;
