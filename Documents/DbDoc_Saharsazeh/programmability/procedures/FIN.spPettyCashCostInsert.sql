CREATE   PROC [FIN].[spPettyCashCostInsert]
    @FinancialPeriodID INT,
    @BranchID INT,
    @PettyCashID INT,
    @Number INT,
    @Date DATE,
    @CurrencyRate DECIMAL(20, 10),
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @PreVoucherID INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Status TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM CFG.DocumentNum d
        WHERE d.DocumentNumTypeID =
        (
            SELECT DocumentNumTypeID
            FROM CFG.DocumentNumType
            WHERE EngName = 'PettyCashCost'
        )
              AND d.FinancialPeriodID = @FinancialPeriodID
    )
    BEGIN
        RAISERROR('در دوره مالی جاری، شماره گذاری صورتخلاصه تنخواه انجام نشده است.', 16, 12);
        RETURN;
    END;

    DECLARE @StartNum INT = NULL,
            @EndNum INT = NULL,
            @Branch BIT = 0,
            @ResetType BIT = 0,
            @DocumentNumID INT;

    SELECT @StartNum = StartNum,
           @EndNum = EndNum,
           @DocumentNumID = DocumentNumID
    FROM cfg.DocumentNum
    WHERE DocumentNumTypeID =
    (
        SELECT DocumentNumTypeID
        FROM CFG.DocumentNumType
        WHERE EngName = 'PettyCashCost'
    )
          AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS
    (
        SELECT 1
        FROM cfg.DocumentNumResetNumberBase
        WHERE DocumentNumID = @DocumentNumID
              AND DocumentNumResetNumberBaseTypeID = 7
    )
    BEGIN
        SET @Branch = 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM cfg.DocumentNumResetNumberBase
        WHERE DocumentNumID = @DocumentNumID
              AND DocumentNumResetNumberBaseTypeID = 6
    )
    BEGIN
        SET @ResetType = 1;
    END;

    IF (@Number IS NOT NULL AND @Number <> 0)
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM FIN.PettyCashCost p
            WHERE p.FinancialPeriodID = @FinancialPeriodID
                  AND p.PettyCashID = @PettyCashID
                  AND p.Number = @Number
                  AND
                  (
                      @Branch = 0
                      OR p.BranchID = @BranchID
                  )
        )
        BEGIN
            RAISERROR('شماره تکراری است.', 16, 12);
            RETURN;
        END;
    END;

    IF (@Number = 0 OR @Number IS NULL)
        SET @Number = ISNULL(
                      (
                          SELECT MAX(Number) + 1
                          FROM [FIN].[PettyCashCost]
                          WHERE FinancialPeriodID = @FinancialPeriodID
                                AND PettyCashID = @PettyCashID
                                AND
                                (
                                    @Branch = 0
                                    OR BranchID = @BranchID
                                )
                      ),
                      @StartNum
                            );

    IF (@Number >= @StartNum AND (@EndNum IS NULL OR @Number <= @EndNum))
    BEGIN
        INSERT INTO [FIN].[PettyCashCost]
        (
            [FinancialPeriodID],
            [BranchID],
            [PettyCashID],
            [Number],
            [Date],
            [CurrencyRate],
            [Description],
            [Description2],
            [PreVoucherID],
            [Version],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            [Status]
        )
        SELECT @FinancialPeriodID,
               @BranchID,
               @PettyCashID,
               @Number,
               @Date,
               @CurrencyRate,
               @Description,
               @Description2,
               @PreVoucherID,
               0,
               @Creator,
               @CreationDate,
               @LastEditor,
               @LastEditionDate,
               @Status;

        -- Begin Return Select <- do not remove
        SELECT [PettyCashCostID],
               [Version],
               [Number]
        FROM [FIN].[PettyCashCost]
        WHERE [PettyCashCostID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
    END;
    ELSE
    BEGIN
        DECLARE @Message NVARCHAR(MAX);
        SELECT @Message = N'InvalidNumberRange';
        RAISERROR(@Message, 16, 12);
        RETURN;
    END;
