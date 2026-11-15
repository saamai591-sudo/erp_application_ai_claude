CREATE   PROC [POS].[spCardReaderSettlementInsert]
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @Description NVARCHAR(2048),
    @Description2 NVARCHAR(2048),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @ToDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @Number = 0
       OR @Number IS NULL
    BEGIN
        SELECT @Number = ISNULL(MAX(crs.Number), 0) + 1
        FROM POS.CardReaderSettlement AS crs;
    END;


    INSERT INTO [POS].[CardReaderSettlement]
    (
        [FinancialPeriodID],
        [Number],
        [Date],
        [Description],
        [Description2],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [ToDate]
    )
    SELECT @FinancialPeriodID,
           @Number,
           @Date,
           @Description,
           @Description2,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0,
           @ToDate;

    -- Begin Return Select <- do not remove
    SELECT [CardReaderSettlementID],
           [Version],
           [Number]
    FROM [POS].[CardReaderSettlement]
    WHERE [CardReaderSettlementID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
END;
