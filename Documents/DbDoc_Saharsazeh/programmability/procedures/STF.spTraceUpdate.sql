CREATE PROC [STF].[spTraceUpdate]
    @TraceID INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @AccountLevelTypeID SMALLINT,
    @DlTypeID INT,
    @PricingBase BIT,
    @MainMeasureUnitCalculatingBase BIT,
    @TraceOrder INT,
    @Version INT,
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

    UPDATE [STF].[Trace]
    SET [Title] = @Title,
        [Title2] = @Title2,
        [AccountLevelTypeID] = @AccountLevelTypeID,
        [DlTypeID] = @DlTypeID,
        [PricingBase] = @PricingBase,
        [MainMeasureUnitCalculatingBase] = @MainMeasureUnitCalculatingBase,
        [Version] = @Version + 1,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Alias] = @Alias,
        TraceOrder = @TraceOrder,
        [OrderView] = @OrderView,
        CheckInventory = @CheckInventory,
        EffectiveInPricing = @EffectiveInPricing,
        IsEffectiveInProduceCost = @IsEffectiveInProduceCost,
        IsEffectiveInConsumeCost = @IsEffectiveInConsumeCost
    WHERE [TraceID] = @TraceID;

    UPDATE tr
    SET tr.TraceOrder = T.Rno
    FROM STF.Trace AS tr
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
            ON T.TraceID = tr.TraceID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] ,
            [TraceOrder]
    FROM [STF].[Trace]
    WHERE [TraceID] = @TraceID;
-- End Return Select <- do not remove

END;
