CREATE PROC [HRM].[SpPaymentSystemInsert] 
    @Code VARCHAR(50),
    @Title NVARCHAR(512),
    @Title2 NVARCHAR(512),
    @HasGroup BIT,
    @HasBase BIT,
    @HasOccupationGrade BIT,
    @OccupationGradeType TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF EXISTS(
           SELECT 1
           FROM   hrm.PaymentSystem  AS et
           WHERE  et.Code = @Code 
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
    END
	
    INSERT INTO [HRM].[PaymentSystem]
      (
        [Code],
        [Title],
        [Title2],
        [HasGroup],
        [HasBase],
        [HasOccupationGrade],
        [OccupationGradeType],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @Code,
           @Title,
           @Title2,
           @HasGroup,
           @HasBase,
           @HasOccupationGrade,
           @OccupationGradeType,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	-- Begin Return Select <- do not remove
    SELECT [PaymentSystemID],
           [Version]
    FROM   [HRM].[PaymentSystem]
    WHERE  [PaymentSystemID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
