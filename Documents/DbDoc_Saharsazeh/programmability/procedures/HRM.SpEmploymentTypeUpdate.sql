CREATE PROC [HRM].[SpEmploymentTypeUpdate] 
    @EmploymentTypeID INT,
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @PaymentSystemID INT = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [HRM].[EmploymentType]
           WHERE  [EmploymentTypeID] = @EmploymentTypeID
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10)
        RETURN
    END

    IF EXISTS(
           SELECT 1
           FROM   hrm.EmploymentType AS et
           WHERE  et.Title = @Title AND et.EmploymentTypeID<>@EmploymentTypeID
       )
    BEGIN
        RAISERROR('عنوان تکراري مي باشد.', 16, 12)
        RETURN;
    END

    IF EXISTS(
           SELECT 1
           FROM   hrm.EmploymentType AS et
           WHERE  et.Code = @Code AND et.EmploymentTypeID<>@EmploymentTypeID
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
    END

    DECLARE @OldPaymentSystemId INT

    SELECT @OldPaymentSystemId = ISNULL(PaymentSystemID, -1)
    FROM   hrm.EmploymentType
    WHERE  EmploymentTypeID = @EmploymentTypeID

    IF (@OldPaymentSystemId <> ISNULL(@PaymentSystemID, -1))
    BEGIN
        IF EXISTS (
               SELECT 1
               FROM   hrm.Agreement
               WHERE  EmploymentTypeID = @EmploymentTypeID
           )
        BEGIN
            RAISERROR(
                'با توجه به اينکه از اين نوع استخدام استفاده شده است امکان تغيير نظام پرداخت نمي باشد.',
                16,
                12
            )
            RETURN
        END
    END

    SET @Version = @Version + 1 

    UPDATE [HRM].[EmploymentType]
    SET    [Code] = @Code,
           [Title] = @Title,
           [Title2] = @Title2,
           [PaymentSystemID] = @PaymentSystemID,
           [Version] = @Version,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate
    WHERE  [EmploymentTypeID] = @EmploymentTypeID
	
		    -- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM   [HRM].[EmploymentType]
    WHERE  [EmploymentTypeID] = @EmploymentTypeID 
           -- End Return Select <- do not remove
