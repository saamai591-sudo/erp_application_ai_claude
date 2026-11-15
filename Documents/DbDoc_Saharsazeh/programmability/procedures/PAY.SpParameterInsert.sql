CREATE PROC [PAY].[SpParameterInsert]
    @CategoryID INT,
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @ParameterTypeID INT,
    @Type TINYINT = NULL,
    @OrganizationID INT = NULL,
    @ReCalcable BIT,
    @HasEstablishment BIT,
    @IsSystem BIT,
    @PaymentTypeID INT,
    @SystemName VARCHAR(50),
    @CalculationTypeID TINYINT,
    @DataEntryType TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @DependantToYear BIT,
    @Code INT NULL

--WITH ENCRYPTION 
AS
BEGIN 
    SET NOCOUNT ON;

    IF @ParameterTypeID <> 8
       AND @CategoryID <> 7
        SET @PaymentTypeID = NULL;

    IF (@CategoryID = 7)
    BEGIN
        IF EXISTS
        (
            SELECT *
            FROM PAY.Parameter p
            WHERE p.CategoryID = 7
                  AND p.Title = @Title
        )
        BEGIN
            RAISERROR('عنوان وام نمی تواند تکراری باشد.', 16, 12);
            RETURN;
        END;
    END;

    IF (@SystemName IS NOT NULL)
    BEGIN
        IF @SystemName = 'KARKARD'
           AND EXISTS
        (
            SELECT 1
            FROM PAY.Parameter AS p
            WHERE p.SystemName = @SystemName
        )
        BEGIN
            RAISERROR('نوع سيستمي تکراری مي باشد.', 16, 12);
            RETURN;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM PAY.Parameter AS p
            WHERE p.SystemName = @SystemName
                  AND p.CalculationTypeID = @CalculationTypeID
        )
        BEGIN
            RAISERROR('نوع سيستمي تکراری مي باشد.', 16, 12);
            RETURN;
        END;
        IF @SystemName IN ( 'khales', 'KOSOR_SUM', 'MAZAYA_SUM' )
           AND @ReCalcable = 1
        BEGIN
            RAISERROR('این عامل نمی تواند معوقه پذیر باشد.', 16, 12);
            RETURN;
        END;
    END;

    INSERT INTO [PAY].[Parameter]
    (
        [CategoryID],
        [Title],
        [Title2],
        [ParameterTypeID],
        [Type],
        [OrganizationID],
        [ReCalcable],
        [HasEstablishment],
        [IsSystem],
        CalculationTypeID,
        [DataEntryType],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        SystemName,
        PaymentTypeID,
        DependantToYear,
        Code
    )
    SELECT @CategoryID,
           @Title,
           @Title2,
           @ParameterTypeID,
           @Type,
           @OrganizationID,
           @ReCalcable,
           @HasEstablishment,
           @IsSystem,
           @CalculationTypeID,
           @DataEntryType,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @SystemName,
           @PaymentTypeID,
           @DependantToYear,
           @Code;

    -- Begin Return Select <- do not remove
    SELECT [ParameterID],
           [Version]
    FROM [PAY].[Parameter]
    WHERE [ParameterID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
END
