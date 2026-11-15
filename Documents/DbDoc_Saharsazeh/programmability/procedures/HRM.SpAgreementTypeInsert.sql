
---------------------------------------------------------------------------------------------------------------------------
CREATE   PROC [HRM].[SpAgreementTypeInsert] 
	@AgreementTypeFormID TINYINT,
    @Title NVARCHAR(512),
    @Title2 NVARCHAR(512),
    @Code VARCHAR(50),
    @Desc NVARCHAR(2048) = NULL,
    @PrePersonelStatusID INT,
    @NeedConfirmation BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
	
    IF EXISTS(
           SELECT 1
           FROM   hrm.AgreementType AS et
           WHERE  et.Code = @Code
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
    END
	
    INSERT INTO [HRM].[AgreementType]
      (
        AgreementTypeFormID,
        [Title],
        [Title2],
        [Code],
        [Desc],
        PrePersonelStatusID,
        NeedConfirmation,
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @AgreementTypeFormID,
           @Title,
           @Title2,
           @Code,
           @Desc,
           @PrePersonelStatusID,
           @NeedConfirmation,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
    -- Begin Return Select <- do not remove
    SELECT AgreementTypeID,
           [Version]
    FROM   [HRM].[AgreementType]
    WHERE  [AgreementTypeID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
