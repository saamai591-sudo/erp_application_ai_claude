CREATE   PROC [POS].[spCardReaderSettlementUpdate]
    @CardReaderSettlementID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @Description NVARCHAR(2048),
    @Description2 NVARCHAR(2048),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @Version =
    (
        SELECT [Version]
        FROM [POS].[CardReaderSettlement]
        WHERE [CardReaderSettlementID] = @CardReaderSettlementID
    )
    BEGIN

        IF @Number = 0
           OR @Number IS NULL
        BEGIN
            SELECT @Number = ISNULL(MAX(crs.Number), 0) + 1
            FROM POS.CardReaderSettlement AS crs;
        END;

        SET @Version = @Version + 1;

        UPDATE [POS].[CardReaderSettlement]
        SET [FinancialPeriodID] = @FinancialPeriodID,
            [Number] = @Number,
            [Date] = @Date,
            [Description] = @Description,
            [Description2] = @Description2,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version,
            [ToDate] = @ToDate
        WHERE [CardReaderSettlementID] = @CardReaderSettlementID;

        -- Begin Return Select <- do not remove
        SELECT  [Version],
				[Number]
        FROM [POS].[CardReaderSettlement]
        WHERE [CardReaderSettlementID] = @CardReaderSettlementID;
    -- End Return Select <- do not remove
    END;
END;
