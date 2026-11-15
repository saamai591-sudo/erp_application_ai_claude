CREATE     PROC [PRM].[spReworkUpdate]
    @ReworkID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @DeliverToCostCenterId INT,
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
        FROM [PRM].[Rework]
        WHERE [ReworkID] = @ReworkID
    )
    BEGIN
        IF @Number IS NULL
           OR @Number = 0
        BEGIN
            SET @Number = ISNULL(
                          (
                              SELECT MAX(ps.Number)
                              FROM PRM.Rework AS ps
                              WHERE ps.FinancialPeriodID = @FinancialPeriodID
                                    AND [ReworkID] <> @ReworkID
                          ),
                          0
                                ) + 1;
        END;
        SET @Version = @Version + 1;

        UPDATE [PRM].[Rework]
        SET [FinancialPeriodID] = @FinancialPeriodID,
            [Number] = @Number,
            [Date] = @Date,
            [CostCenterId] = @CostCenterId,
            [DeliverToCostCenterId] = @DeliverToCostCenterId,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version
        WHERE [ReworkID] = @ReworkID;

        -- Begin Return Select <- do not remove
        SELECT [Version],
            [Number]
        FROM [PRM].[Rework]
        WHERE [ReworkID] = @ReworkID;
        -- End Return Select <- do not remove
    END;
