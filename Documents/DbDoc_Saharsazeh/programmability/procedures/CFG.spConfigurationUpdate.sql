
------------------------------------------------
CREATE     PROC [CFG].spConfigurationUpdate
    @ID INT,
    @ConfigKey VARCHAR(50),
    @ConfigValue NVARCHAR(max),
    @ConfigType TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION 
AS
SET NOCOUNT ON;
    DECLARE @TableName1 NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @FinancialPeriodID INT,
            @Message NVARCHAR(MAX),
            @Param NVARCHAR(MAX),
            @Error BIT = 0;

    IF @Version <> ( SELECT [Version] FROM [CFG].[Configuration] WHERE [ID] = @ID)
	BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;

    IF @ConfigKey = 'IndependentStuffCoding'
       AND @ConfigValue = 'True'
       AND EXISTS
       (
           SELECT s.Code
           FROM STF.Stuff AS s
           GROUP BY s.Code
           HAVING COUNT(*) > 1
       )
    BEGIN
		SET @Message = 'CanNotChangeIndependentStuffCoding'
        RAISERROR(@Message, 16, 12);
        RETURN;
    END;

    IF (@ConfigKey = 'IsPaymentSystemInstalled')
    BEGIN
        IF EXISTS (SELECT AgreementID FROM HRM.Agreement)
        BEGIN
            RAISERROR('امکان تغيير  نظام پرداخت نصب است  نمي باشد', 16, 12);
            RETURN;
        END;
    END;
	
    IF @ConfigKey = 'InvoiceNeedConfirm'
    BEGIN

        DECLARE @oldValue NVARCHAR(100);
        SELECT @oldValue = c.ConfigValue
        FROM CFG.Configuration AS c
        WHERE c.ConfigKey = @ConfigKey;

        IF (@oldValue = 'true' AND @ConfigValue = 'false')
        BEGIN
            UPDATE SLE.Invoice
            SET [SaleInvoiceStatus] = 1
            WHERE [SaleInvoiceStatus] = 2;
        END;
    END;

    IF @ConfigKey = 'JustNumericValueIsAcceptableInStuffCode' 
        AND @ConfigValue = 'True'
        AND EXISTS(SELECT 1 FROM STF.[Stuff] s WHERE TRY_CONVERT(DECIMAL(38, 0), s.Code) is NULL)
    BEGIN
        SET @Message = 'BaseDataProvider.Messages.FirstCorrectStuffCodeDueToJustNumericValueIsAcceptableInStuffCodeConfig'
        RAISERROR(@Message, 16, 12);
        RETURN;
    END 

    UPDATE [CFG].[Configuration]
    SET [ID] = @ID,
        [ConfigKey] = @ConfigKey,
        [ConfigValue] = @ConfigValue,
        [ConfigType] = @ConfigType,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version + 1
    WHERE [ID] = @ID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [CFG].[Configuration]
    WHERE [ID] = @ID;
