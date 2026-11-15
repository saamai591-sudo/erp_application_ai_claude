CREATE PROC [HRM].[SpBaseValuePaymentSystemUpdate] 
    @BaseValuePaymentSystemID INT,
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
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [HRM].[BaseValuePaymentSystem]
           WHERE  [BaseValuePaymentSystemID] = @BaseValuePaymentSystemID
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10)
        RETURN
    END

    IF EXISTS(
           SELECT 1
           FROM   [HRM].[BaseValuePaymentSystem]
           WHERE  BaseValuePaymentSystemID <> @BaseValuePaymentSystemID
                  AND BaseValueID = @BaseValueID
                  AND PaymentSystemID = @PaymentSystemID
       )
    BEGIN
        RAISERROR(
            'امکان تعريف نظام پرداخت تکراري براي يک ضريب نمي باشد.',
            16,
            12
        )
        RETURN
    END

    DECLARE @OldHasGroup               BIT,
            @OldHasBase                BIT,
            @OldHasOccupationGrade     BIT,
            @OldHasJob                 BIT,
            @OldHasPersonel            BIT,
            @oldPaymentSystemID        INT,
            @oldHasJobGroup            BIT
			
    SELECT @OldHasGroup = bvps.HasGroup,
           @OldHasBase                = bvps.HasBase,
           @OldHasOccupationGrade     = bvps.HasOccupationGrade,
           @OldHasJob                 = bvps.HasJob,
           @OldHasPersonel            = bvps.HasPersonel,
           @oldPaymentSystemID        = bvps.PaymentSystemID,
           @oldHasJobGroup            = bvps.HasJobGroup
    FROM   hrm.BaseValuePaymentSystem bvps
    WHERE  bvps.BaseValuePaymentSystemID = @BaseValuePaymentSystemID

    IF @OldHasGroup <> @HasGroup
       OR @OldHasBase <> @HasBase
       OR @OldHasOccupationGrade <> @HasOccupationGrade
       OR @OldHasJob <> @HasJob
       OR @OldHasPersonel <> @HasPersonel
       OR @oldPaymentSystemID <> @PaymentSystemID
       OR @oldHasJobGroup <> @HasJobGroup
    BEGIN
        IF EXISTS (
               SELECT bvd.BaseValueDataID
               FROM   hrm.BaseValueData bvd
               WHERE  bvd.BaseValueID = @BaseValueID
                      AND bvd.PaymentSystemID = @PaymentSystemID
           )
        BEGIN
            RAISERROR(
                'براي انجام تغيير مورد نظر لطفا ابتدا اطلاعات ضرايب مربوطه را حذف نماييد.',
                16,
                12
            )
            RETURN
        END
    END

    SET @Version = @Version + 1 

    UPDATE [HRM].[BaseValuePaymentSystem]
    SET    [BaseValueID] = @BaseValueID,
           [PaymentSystemID] = @PaymentSystemID,
           [HasGroup] = @HasGroup,
           [HasBase] = @HasBase,
           [HasOccupationGrade] = @HasOccupationGrade,
           [HasJob] = @HasJob,
           [HasPersonel] = @HasPersonel,
           HasJobGroup = @HasJobGroup,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate,
           [Version] = @Version,
           HasAgreement = @HasAgreement
    WHERE  [BaseValuePaymentSystemID] = @BaseValuePaymentSystemID
	
	-- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM   [HRM].[BaseValuePaymentSystem]
    WHERE  [BaseValuePaymentSystemID] = @BaseValuePaymentSystemID 
    -- End Return Select <- do not remove
