CREATE PROC [HRM].[SpBaseValuePaymentSystemInsert] 
    @BaseValueID INT,
    @PaymentSystemID INT,
    @HasGroup BIT,
    @HasBase BIT,
    @HasOccupationGrade BIT,
    @HasJob BIT,
    @HasPersonel BIT,
    @HasAgreement BIT,
    @HasJobGroup  BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
    IF EXISTS(
           SELECT 1
           FROM   [HRM].[BaseValuePaymentSystem]
           WHERE  BaseValueID             = @BaseValueID
                  AND PaymentSystemID     = @PaymentSystemID
       )
    BEGIN
        RAISERROR(N'امکان تعريف نظام پرداخت تکراري براي يک ضريب نمي باشد.', 16, 12)
        RETURN
    END
	
    INSERT INTO [HRM].[BaseValuePaymentSystem]
      (
        [BaseValueID],
        [PaymentSystemID],
        [HasGroup],
        [HasBase],
        [HasOccupationGrade],
        [HasJob],
        [HasPersonel],
        HasAgreement,
        HasJobGroup,
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @BaseValueID,
           @PaymentSystemID,
           @HasGroup,
           @HasBase,
           @HasOccupationGrade,
           @HasJob,
           @HasPersonel,
           @HasAgreement,
           @HasJobGroup,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	-- Begin Return Select <- do not remove
    SELECT [BaseValuePaymentSystemID],
           [Version]
    FROM   [HRM].[BaseValuePaymentSystem]
    WHERE  [BaseValuePaymentSystemID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
