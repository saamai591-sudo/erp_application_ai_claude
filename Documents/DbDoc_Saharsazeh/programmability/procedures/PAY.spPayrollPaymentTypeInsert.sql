
-------------------------------------------------------------------------------------------------------------
CREATE     PROC [PAY].[spPayrollPaymentTypeInsert]
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @Type TINYINT,
    @OrganizationID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@IsActive bit,
	@CreatePayrollFile bit
AS
    SET NOCOUNT ON;

    IF @Code = 0
       OR @Code IS NULL
        SET @Code = ISNULL(
                    (
                        SELECT MAX(Code) + 1 FROM [PAY].[PayrollPaymentType]
                    ),
                    0
                          );

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Code = @Code
    )
    BEGIN
        RAISERROR('Code_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Title = @Title
    )
    BEGIN
        RAISERROR('Title_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM PAY.PayrollPaymentType AS ppt
        WHERE ppt.Title2 = @Title2
    )
    BEGIN
        RAISERROR('Title2_Duplicated', 16, 12);
        RETURN;
    END;

    INSERT INTO [PAY].[PayrollPaymentType]
    (
        [Code],
        [Title],
        [Title2],
        [Type],
        [OrganizationID],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
	    IsActive,
		CreatePayrollFile
    )
    SELECT @Code,
           @Title,
           @Title2,
           @Type,
           @OrganizationID,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0,
	       @IsActive,
		   @CreatePayrollFile 

    -- Begin Return Select <- do not remove
    SELECT [PayrollPaymentTypeID],
           [Code],
           [Version]
    FROM [PAY].[PayrollPaymentType]
    WHERE [PayrollPaymentTypeID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
