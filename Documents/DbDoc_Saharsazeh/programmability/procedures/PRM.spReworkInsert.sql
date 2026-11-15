CREATE      PROC [PRM].[spReworkInsert]
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @DeliverToCostCenterId INT,
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
                          FROM PRM.Rework AS ps
                          WHERE ps.FinancialPeriodID = @FinancialPeriodID
                      ),
                      0
                            ) + 1;
    END;

    INSERT INTO [PRM].[Rework]
    (
        [FinancialPeriodID],
        [Number],
        [Date],
        [CostCenterId],
        [DeliverToCostCenterId],
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
           @DeliverToCostCenterId,  
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0;

    -- Begin Return Select <- do not remove
    SELECT [ReworkID],
           [Version],
           [Number]
    FROM [PRM].[Rework]
    WHERE [ReworkID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
