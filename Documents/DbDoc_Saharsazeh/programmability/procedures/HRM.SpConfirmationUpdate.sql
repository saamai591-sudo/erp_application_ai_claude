-------------------------------------
CREATE   PROC [HRM].[SpConfirmationUpdate] 
    @ConfirmationID INT,
    @ConfirmationTypeID INT,
    @ConfirmationRequestID INT,
    @PersonelID INT,
    @IssueDate DATE,
    @Reciver NVARCHAR(1024) = NULL,
    @ReciverPerson NVARCHAR(1024) = NULL,
    @Amount DECIMAL(18, 4) = NULL,
    @InstallmentAmount DECIMAL(18, 4) = NULL,
    @Description NVARCHAR(2048) = NULL,
    @Value1 NVARCHAR(2048) = NULL,
    @Value2 NVARCHAR(2048) = NULL,
    @Value3 NVARCHAR(2048) = NULL,
    @CloseDate DATE = NULL,
    @CloseType TINYINT = NULL,
    @Number INT = NULL,
    @ConfirmationStatus  TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS 

SET NOCOUNT ON 

IF @Version <> (
       SELECT [Version]
       FROM   [HRM].[Confirmation]
       WHERE  [ConfirmationID] = @ConfirmationID
   )
BEGIN
    RAISERROR('Version mismatch...', 16, 10)
    RETURN
END

IF EXISTS (
       SELECT 1
       FROM   hrm.Confirmation c
       WHERE  c.ConfirmationTypeID = @ConfirmationTypeID
              AND c.Number = @NUmber
              AND c.ConfirmationID <> @ConfirmationID
   )
BEGIN
    RAISERROR('شماره گواهي تکراري مي باشد.', 16, 12)
    RETURN
END
    
DECLARE @OldAmount                DECIMAL(18, 4),
        @OldInstallmentAmount     DECIMAL(18, 4),
        @OldIssueDate   DATE,
        @OldPersonelId   INT,
        @OldConfirmationTypeID int

SELECT @OldAmount = c.Amount,
       @OldInstallmentAmount = c.InstallmentAmount,
       @OldIssueDate=c.IssueDate,
       @OldPersonelId=c.PersonelID,
       @OldConfirmationTypeID=c.ConfirmationTypeID
FROM   hrm.Confirmation AS c
WHERE  c.ConfirmationID = @ConfirmationID
    
IF @Amount <> @OldAmount
   OR @InstallmentAmount <> @OldInstallmentAmount
   OR @PersonelID <> @OldpersonelId
   OR @IssueDate <> @OldIssueDate
   OR @ConfirmationTypeID<>@OldConfirmationTypeID
BEGIN
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
        IF @InstallmentAmount IS NULL
        BEGIN
            RAISERROR('لطفا مقدار قسط را مشخص نماييد.', 16, 12)
            RETURN
        END
        
        DECLARE @ConfirmationFormID INT
        
        SELECT @ConfirmationFormID = ct.ConfirmationFormID
        FROM   hrm.ConfirmationType ct
        WHERE  ct.ConfirmationTypeID = @ConfirmationTypeId
        
        SELECT @Used = SUM(c.InstallmentAmount)
        FROM   hrm.Confirmation c
               INNER JOIN HRM.ConfirmationType ct
                    ON  ct.ConfirmationTypeID = c.ConfirmationTypeID
        WHERE  ct.ConfirmationFormID = @ConfirmationFormID
               AND c.PersonelID = @PersonelId
               AND (c.ConfirmationID <> @ConfirmationID)
               AND CloseDate IS NULL
        
        IF @Ceil -ISNULL(@Used, 0) < @InstallmentAmount
        BEGIN
            RAISERROR('مقدار ضمانت وارد شده بيشتر از سقف مجاز مي باشد.', 16, 12)
            RETURN
        END
    END
END

SET @Version = @Version + 1 

UPDATE [HRM].[Confirmation]
SET    [ConfirmationTypeID] = @ConfirmationTypeID,
       [ConfirmationRequestID] = @ConfirmationRequestID,
       [PersonelID] = @PersonelID,
       [IssueDate] = @IssueDate,
       [Reciver] = @Reciver,
       [ReciverPerson] = @ReciverPerson,
       [Amount] = @Amount,
       [InstallmentAmount] = @InstallmentAmount,
       [Description] = @Description,
       [Value1] = @Value1,
       [Value2] = @Value2,
       [Value3] = @Value3,
       [CloseDate] = @CloseDate,
       [CloseType] = @CloseType,
       [Creator] = @Creator,
       [CreationDate] = @CreationDate,
       [LastEditor] = @LastEditor,
       [LastEditionDate] = @LastEditionDate,
       [Version] = @Version,
       Number = @Number,
       [ConfirmationStatus] = @ConfirmationStatus
WHERE  [ConfirmationID] = @ConfirmationID
	
		-- Begin Return Select <- do not remove
SELECT [Version],
       Number
FROM   [HRM].[Confirmation]
WHERE  [ConfirmationID] = @ConfirmationID 
       -- End Return Select <- do not remove
