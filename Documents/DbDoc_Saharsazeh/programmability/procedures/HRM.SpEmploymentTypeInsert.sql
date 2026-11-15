CREATE PROC [HRM].[SpEmploymentTypeInsert] 
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @PaymentSystemID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME 
--WITH ENCRYPTION
AS 

    SET NOCOUNT ON 
	
    IF EXISTS(
           SELECT 1
           FROM   hrm.EmploymentType AS et
           WHERE  et.Code = @Code
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
    END

    IF EXISTS(
           SELECT 1
           FROM   hrm.EmploymentType AS et
           WHERE  et.Title = @Title
       )
    BEGIN
        RAISERROR('عنوان تکراري مي باشد.', 16, 12)
        RETURN;
    END
	
    INSERT INTO [HRM].[EmploymentType]
      (
        [Code],
        [Title],
        [Title2],
        [PaymentSystemID],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @Code,
           @Title,
           @Title2,
           @PaymentSystemID,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
	    -- Begin Return Select <- do not remove
    SELECT  [EmploymentTypeID],
            [Version]
    FROM   [HRM].[EmploymentType]
    WHERE  [EmploymentTypeID] = SCOPE_IDENTITY()
           -- End Return Select <- do not remove
