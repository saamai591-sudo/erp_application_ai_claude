
-------------------------------------------------------------------------------------------------------------
CREATE     PROC [PAY].[spPayrollPaymentTypeUpdate]
    @PayrollPaymentTypeID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @Type TINYINT,
    @OrganizationID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
	@IsActive bit,
	@CreatePayrollFile bit
AS
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Code = @Code AND ppt.PayrollPaymentTypeID <> @PayrollPaymentTypeID
    )
    BEGIN
        RAISERROR('Code_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Title = @Title AND ppt.PayrollPaymentTypeID <> @PayrollPaymentTypeID
    )
    BEGIN
        RAISERROR('Title_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Title2 = @Title2 AND ppt.PayrollPaymentTypeID <> @PayrollPaymentTypeID
    )
    BEGIN
        RAISERROR('Title2_Duplicated', 16, 12);
        RETURN;
    END;

    IF @Version =
    (
        SELECT [Version]
        FROM [PAY].[PayrollPaymentType]
        WHERE [PayrollPaymentTypeID] = @PayrollPaymentTypeID
    )
    BEGIN

        SET @Version = @Version + 1;

        UPDATE [PAY].[PayrollPaymentType]
        SET [Code] = @Code,
            [Title] = @Title,
            [Title2] = @Title2,
            [Type] = @Type,
            [OrganizationID] = @OrganizationID,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version,
		    IsActive = @IsActive,
			CreatePayrollFile = @CreatePayrollFile
        WHERE [PayrollPaymentTypeID] = @PayrollPaymentTypeID;

        -- Begin Return Select <- do not remove
        SELECT  [Version], [Code]
         FROM [PAY].[PayrollPaymentType]
        WHERE [PayrollPaymentTypeID] = @PayrollPaymentTypeID;
    -- End Return Select <- do not remove

    END;
	ELSE 
        RAISERROR('Version mismatch...', 16, 10);
