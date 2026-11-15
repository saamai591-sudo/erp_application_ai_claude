------------------------------------- 
CREATE   PROC [ACC].[spSLUpdate]
    @SlID INT,
    @ParentID INT,
    @CurrencyExchangeSlID INT,
    @Code VARCHAR(50),
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @BalanceTypeID TINYINT,
    @HasBalanceTypeCheck BIT,
    @HasCurrency BIT,
    @HasCurrencyConversion BIT,
    @IsActive BIT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @SlTreeLevelID SMALLINT,
    @IsMoeen BIT

--WITH ENCRYPTION 
AS
SET NOCOUNT ON;

IF @SlID = @ParentID
BEGIN
    RAISERROR('Accounting.SLParentIdIssue', 16, 12);
    RETURN;
END;

IF EXISTS
(
    SELECT 1
    FROM ACC.SL AS s
    WHERE s.ParentID = @ParentID
          AND s.Code = @Code
          AND s.SlID <> @SlID
)
BEGIN
    RAISERROR('Code_Duplicated', 16, 12);
    RETURN;
END;

IF @IsMoeen = 1
   AND EXISTS
(
    SELECT 1
    FROM ACC.SL AS s
    WHERE s.ParentID = @SlID
)
BEGIN
    RAISERROR('Accounting.SlsCantHaveChild', 16, 12);
    RETURN;
END;

IF EXISTS (SELECT 1 FROM ACC.SL WHERE IsMoeen = 1 AND SlID = @ParentID)
BEGIN

    RAISERROR('Accounting.SL_Is_Not_Valid_Parent', 16, 12);
    RETURN;
END;

IF @IsMoeen = 1
   AND
   (
       SELECT LevelType
       FROM ACC.SlTreeLevel AS stl
       WHERE stl.SlTreeLevelID = @SlTreeLevelID
   ) <> 4
BEGIN

    RAISERROR('Accounting.Only_Other_Can_Be_Sl', 16, 12);
    RETURN;
END;


IF @IsMoeen = 0
   AND @SlTreeLevelID = 4
BEGIN
    DECLARE @lastIsMoeen BIT;
    SELECT @lastIsMoeen = IsMoeen
    FROM ACC.SL
    WHERE SlID = @SlID;

    IF @lastIsMoeen = 1
    BEGIN

        DECLARE @T TABLE
        (
            VAL VARCHAR(1024)
        );

        INSERT INTO @T
        EXEC CFG.GetDepndetTable @TableName = 'Sl', @ID = @SlID;

        DECLARE @Value VARCHAR(1024);
        SELECT @Value = VAL
        FROM @T;

        IF @Value IS NOT NULL
           AND @Value <> ''
        BEGIN
            RAISERROR('Accounting.SL_CAN_NOT_CHANGE', 16, 12);
            RETURN;
        END;

    END;

END;


DECLARE @lastParent INT;

SELECT @lastParent = s.ParentID
FROM ACC.SL AS s
WHERE s.SlID = @SlID;

--SATURNNEW-4287
IF @lastParent IS NOT NULL
   AND @lastParent <> @ParentID
BEGIN

    DECLARE @levelType INT;

    SELECT @levelType = stl.LevelType
    FROM ACC.SlTreeLevel AS stl
    WHERE stl.SlTreeLevelID = @SlTreeLevelID;

    IF @IsMoeen = 1
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM ACC.VoucherItem AS vi
                INNER JOIN ACC.Voucher AS v
                    ON v.VoucherID = vi.VoucherID
            WHERE vi.SlID = @SlID
                  AND v.VoucherStatusID = 4
        )
        BEGIN
            RAISERROR('به دلیل استفاده در اسناد تایید شده، امکان ویرایش مرجع نمی باشد.', 16, 12);
            RETURN;
        END;
    END;
    IF @levelType = 2
    BEGIN

        SELECT SlID
        INTO #slItems
        FROM ACC.SL
        WHERE IsMoeen = 1
              AND ACC.SlKolId(SlID) = @SlID;


        IF EXISTS
        (
            SELECT 1
            FROM ACC.VoucherItem AS vi
                INNER JOIN ACC.Voucher AS v
                    ON v.VoucherID = vi.VoucherID
                INNER JOIN ACC.SL AS s
                    ON s.SlID = vi.SlID
                INNER JOIN #slItems
                    ON #slItems.SlID = s.SlID
            WHERE v.VoucherStatusID = 4
        )
        BEGIN
            RAISERROR('به دلیل استفاده در اسناد تایید شده، امکان ویرایش مرجع نمی باشد.', 16, 12);
            RETURN;
        END;
    END;
END;


IF @Version <>
(
    SELECT [Version] FROM [ACC].[SL] WHERE [SlID] = @SlID
)
    RAISERROR('Version mismatch...', 16, 10);

UPDATE [ACC].[SL]
SET [ParentID] = @ParentID,
    [CurrencyExchangeSlID] = @CurrencyExchangeSlID,
    [Code] = @Code,
    [Title] = @Title,
    [Title2] = @Title2,
    [BalanceTypeID] = @BalanceTypeID,
    [HasBalanceTypeCheck] = @HasBalanceTypeCheck,
    [HasCurrency] = @HasCurrency,
    [HasCurrencyConversion] = @HasCurrencyConversion,
    [IsActive] = @IsActive,
    [Version] = @Version + 1,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    [SlTreeLevelID] = @SlTreeLevelID,
    IsMoeen = @IsMoeen
WHERE [SlID] = @SlID;

-- Begin Return Select <- do not remove
SELECT [Version]
FROM [ACC].[SL]
WHERE [SlID] = @SlID;
-- End Return Select <- do not remove

