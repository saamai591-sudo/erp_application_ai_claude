CREATE PROC [FIN].[spPettyCashCostUpdate]
    @PettyCashCostID INT,
    @FinancialPeriodID INT,
    @BranchID INT,
    @PettyCashID INT,
    @Number INT,
    @Date DATE,
    @CurrencyRate DECIMAL(20, 10),
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @PreVoucherID INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Status TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @prePrevoucherID INT,
            @PreVersion INT,
            @OldDate DATE;

    SELECT @PreVersion = [Version],
           @prePrevoucherID = PreVoucherID,
           @OldDate = Date
    FROM [FIN].[PettyCashCost]
    WHERE [PettyCashCostID] = @PettyCashCostID;

    IF @Version <> @PreVersion
       OR @prePrevoucherID IS NOT NULL
        RAISERROR('Version mismatch...', 16, 10);

    IF
    (
        SELECT COUNT(*)
        FROM FIN.PettyCashCostItem i
            JOIN FIN.PaymentType t
                ON i.PaymentTypeID = t.PaymentTypeID
        WHERE i.PettyCashCostID = @PettyCashCostID
              AND t.AnnouncedInAdditionalValue = 1
    ) > 0
    BEGIN
        EXEC CFG.CheckWithVatAndSeason @Date = @OldDate,                        -- date
                                       @FinancialPeriodID = @FinancialPeriodID; -- int

        EXEC CFG.CheckWithVatAndSeason @Date = @Date,                           -- date
                                       @FinancialPeriodID = @FinancialPeriodID; -- int
    END;

    IF NOT EXISTS
    (
        SELECT *
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
            @DocumentNumID INT = NULL;

    SELECT @StartNum = StartNum,
           @EndNum = EndNum,
           @DocumentNumID = DocumentNumID
    FROM CFG.DocumentNum
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
        SELECT *
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
            WHERE p.PettyCashCostID <> @PettyCashCostID
                  AND p.FinancialPeriodID = @FinancialPeriodID
                  AND p.Number = @Number
                  AND p.PettyCashID = @PettyCashID
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
                                AND PettyCashCostID <> @PettyCashCostID
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
        DECLARE @PrePettyCashID INT,
                @Message NVARCHAR(MAX);

        SELECT @PrePettyCashID = PettyCashID
        FROM FIN.PettyCashCost
        WHERE PettyCashCostID = @PettyCashCostID;

        UPDATE [FIN].[PettyCashCost]
        SET [BranchID] = @BranchID,
            [PettyCashID] = @PettyCashID,
            [Number] = @Number,
            [Date] = @Date,
            [CurrencyRate] = @CurrencyRate,
            [Description] = @Description,
            [Description2] = @Description2,
            [Version] = @Version + 1,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Status] = @Status
        WHERE [PettyCashCostID] = @PettyCashCostID;

        -- Begin Return Select <- do not remove
        SELECT [Version], [Number]
		FROM [FIN].[PettyCashCost]
        WHERE [PettyCashCostID] = @PettyCashCostID;
        -- End Return Select <- do not remove
    END;
    ELSE
    BEGIN
        SELECT @Message = N'InvalidNumberRange';
        RAISERROR(@Message, 16, 12);
        RETURN;
    --RAISERROR('شماره در محدوده ي مجاز نمي باشد', 16, 12)
    END;
