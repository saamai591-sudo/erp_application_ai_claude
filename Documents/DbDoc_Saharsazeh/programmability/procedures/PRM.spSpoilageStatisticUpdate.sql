CREATE   PROC [PRM].[spSpoilageStatisticUpdate]
    @SpoilageStatisticID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[SpoilageStatistic]
    WHERE [SpoilageStatisticID] = @SpoilageStatisticID
)
BEGIN
    IF @Number IS NULL
       OR @Number = 0
    BEGIN

        SET @Number = ISNULL(
                      (
                          SELECT MAX(ps.Number)
                          FROM PRM.SpoilageStatistic AS ps
                          WHERE ps.FinancialPeriodID = @FinancialPeriodID
                                AND [SpoilageStatisticID] <> @SpoilageStatisticID
                      ),
                      0
                            ) + 1;
    END;
    SET @Version = @Version + 1;

    UPDATE [PRM].[SpoilageStatistic]
    SET [FinancialPeriodID] = @FinancialPeriodID,
        [Number] = @Number,
        [Date] = @Date,
        [CostCenterId] = @CostCenterId,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [SpoilageStatisticID] = @SpoilageStatisticID;

    -- Begin Return Select <- do not remove
    SELECT [Version],
        [Number]
    FROM [PRM].[SpoilageStatistic]
    WHERE [SpoilageStatisticID] = @SpoilageStatisticID;
-- End Return Select <- do not remove

END;
