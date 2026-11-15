CREATE       PROC [PRM].[spSpoilageStatisticInsert]
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF @Number IS NULL
       OR @Number = 0
    BEGIN

        SET @Number = ISNULL(
                      (
                          SELECT MAX(ps.Number)
                          FROM PRM.SpoilageStatistic AS ps
                          WHERE ps.FinancialPeriodID = @FinancialPeriodID
                      ),
                      0
                            ) + 1;
    END;

    INSERT INTO [PRM].[SpoilageStatistic]
    (
        [FinancialPeriodID],
        [Number],
        [Date],
        [CostCenterId],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT @FinancialPeriodID,
           @Number,
           @Date,
           @CostCenterId,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0;

    -- Begin Return Select <- do not remove
    SELECT [SpoilageStatisticID],
           [Version],
           [Number]
    FROM [PRM].[SpoilageStatistic]
    WHERE [SpoilageStatisticID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
