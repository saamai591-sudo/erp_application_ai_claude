CREATE   PROC [PAY].[SpParameterUpdate]
    @ParameterID INT,
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
    @CalculationTypeID TINYINT,
    @DataEntryType TINYINT,
    @SystemName VARCHAR(50),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @DependantToYear BIT,
    @Code INT NULL
--WITH ENCRYPTION 
AS
    SET NOCOUNT ON;

    IF @Version =
    (
        SELECT [Version] FROM [PAY].[Parameter] WHERE [ParameterID] = @ParameterID
    )
    BEGIN
        IF @ParameterTypeID <> 8
           AND @CategoryID <> 7
            SET @PaymentTypeID = NULL;


        IF (@CategoryID = 7)
        BEGIN
            IF EXISTS
            (
                SELECT *
                FROM PAY.Parameter P
                WHERE P.CategoryID = 7
                      AND P.Title = @Title
                      AND P.ParameterID <> @ParameterID
            )
            BEGIN
                RAISERROR('عنوان وام نمی تواند تکراری باشد.', 16, 12);
                RETURN;
            END;
        END;


        IF EXISTS
        (
            SELECT 1
            FROM PAY.Parameter AS p
                INNER JOIN PAY.CalculationMethod AS cm
                    ON cm.ParameterID = p.ParameterID
                INNER JOIN PAY.Formula AS f
                    ON f.CalculationMethodID = cm.CalculationMethodID
            WHERE p.ParameterID = @ParameterID
        )
        BEGIN
            IF @ParameterTypeID <>
            (
                SELECT ParameterTypeID
                FROM PAY.Parameter AS p
                WHERE p.ParameterID = @ParameterID
            )
            BEGIN
                RAISERROR('PayrollManager.CAN_NOT_CHANGE_TYPE_DUE_TO_FORMULA', 16, 12);
                RETURN;
            END;
            IF @SystemName IN ( 'khales', 'KOSOR_SUM', 'MAZAYA_SUM' )
               AND @ReCalcable = 1
            BEGIN
                RAISERROR('این عامل نمی تواند معوقه پذیر باشد.', 16, 12);
                RETURN;
            END;
        END;

        UPDATE [PAY].[Parameter]
        SET [CategoryID] = @CategoryID,
            [Title] = @Title,
            [Title2] = @Title2,
            [CalculationTypeID] = @CalculationTypeID,
            [SystemName] = @SystemName,
            [ParameterTypeID] = @ParameterTypeID,
            [Type] = @Type,
            [OrganizationID] = @OrganizationID,
            [ReCalcable] = @ReCalcable,
            [HasEstablishment] = @HasEstablishment,
            [IsSystem] = @IsSystem,
            [DataEntryType] = @DataEntryType,
            [Version] = @Version,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [PaymentTypeID] = @PaymentTypeID,
            [DependantToYear] = @DependantToYear,
            [Code]=@Code
        WHERE [ParameterID] = @ParameterID;

        -- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM [PAY].[Parameter]
        WHERE [ParameterID] = @ParameterID;
    -- End Return Select <- do not remove
    END;
