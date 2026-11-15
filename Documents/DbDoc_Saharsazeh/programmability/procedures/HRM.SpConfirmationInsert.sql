-------------------------------------
CREATE   PROC [HRM].[SpConfirmationInsert] 
    @ConfirmationTypeID INT,
    @ConfirmationRequestID INT,
    @PersonelID INT,
    @IssueDate date,
    @Reciver NVARCHAR(1024) = NULL,
    @ReciverPerson NVARCHAR(1024) = NULL,
    @Amount DECIMAL(18, 4) = NULL,
    @InstallmentAmount DECIMAL(18, 4) = NULL,
    @Description NVARCHAR(2048) = NULL,
    @Value1 NVARCHAR(2048) = NULL,
    @Value2 NVARCHAR(2048) = NULL,
    @Value3 NVARCHAR(2048) = NULL,
    @Number   INT = NULL,
    @CloseDate date = NULL,
    @CloseType TINYINT = NULL,
    @ConfirmationStatus  TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF (@NUmber=0)
	    SET @NUmber=hrm.getNewConfirmationNumber(@ConfirmationTypeID)
		
    IF EXISTS (
           SELECT 1
           FROM   hrm.Confirmation c
           WHERE  c.ConfirmationTypeID = @ConfirmationTypeID
                  AND c.Number = @NUmber
       )
    BEGIN
        RAISERROR('شماره گواهي تکراري مي باشد.', 16, 12)
        RETURN
    END

    CREATE TABLE #value
    (
	    val DECIMAL
    )
	
    INSERT INTO #value
    EXEC Hrm.CalcConfirmationCeil @PErsonelId,
         @ConfirmationTypeId,
         @IssueDate

    DECLARE @Ceil     DECIMAL,
            @Used     DECIMAL

    SELECT @Ceil = Val
    FROM   #value
	
    IF @Ceil IS NOT NULL
    BEGIN
        DECLARE @ConfirmationFormID INT
    
        SELECT @ConfirmationFormID = ct.ConfirmationFormID
        FROM   hrm.ConfirmationType ct
        WHERE  ct.ConfirmationTypeID = @ConfirmationTypeId
    
        IF @InstallmentAmount IS NULL
        BEGIN
            RAISERROR('لطفا مقدار قسط را مشخص نماييد.', 16, 12)
            RETURN
        END
    
        SELECT @Used = SUM(c.InstallmentAmount)
        FROM   hrm.Confirmation c
               INNER JOIN HRM.ConfirmationType ct
                    ON  ct.ConfirmationTypeID = c.ConfirmationTypeID
        WHERE  ct.ConfirmationFormID = @ConfirmationFormID
               AND c.PersonelID = @PersonelId
               AND CloseDate IS NULL
    
    
        IF @Ceil -ISNULL(@Used, 0) < @InstallmentAmount
        BEGIN
            RAISERROR('مقدار ضمانت وارد شده بيشتر از سقف مجاز مي باشد.', 16, 12)
            RETURN
        END
    END
	
    INSERT INTO [HRM].[Confirmation]
      (
        [ConfirmationTypeID],
        [ConfirmationRequestID],
        [PersonelID],
        [IssueDate],
        [Reciver],
        [ReciverPerson],
        [Amount],
        [InstallmentAmount],
        [Description],
        [Value1],
        [Value2],
        [Value3],
        [CloseDate],
        [CloseType],
        Number,
        [ConfirmationStatus],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @ConfirmationTypeID,
           @ConfirmationRequestID,
           @PersonelID,
           @IssueDate,
           @Reciver,
           @ReciverPerson,
           @Amount,
           @InstallmentAmount,
           @Description,
           @Value1,
           @Value2,
           @Value3,
           @CloseDate,
           @CloseType,
           @Number,
           @ConfirmationStatus,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
    -- Begin Return Select <- do not remove
    SELECT [ConfirmationID],
           [Version],
           Number
    FROM   [HRM].[Confirmation]
    WHERE  [ConfirmationID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
