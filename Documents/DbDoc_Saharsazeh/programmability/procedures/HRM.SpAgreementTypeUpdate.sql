CREATE PROCedure [HRM].[SpAgreementTypeUpdate] 
    @AgreementTypeID TINYINT,
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
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [HRM].[AgreementType]
           WHERE  [AgreementTypeID] = @AgreementTypeID
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10)
        RETURN
    END

    IF EXISTS(
           SELECT 1
           FROM   hrm.AgreementType  AS et
           WHERE  et.Code = @Code AND et.AgreementTypeID<>@AgreementTypeID
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN;
    END

    SET @Version = @Version + 1 

    UPDATE [HRM].[AgreementType]
    SET		AgreementTypeFormID = @AgreementTypeFormID,
	        [Title] = @Title,
           [Title2] = @Title2,
           [Code] = @Code,
           [Desc] = @Desc,
           PrePersonelStatusID=@PrePersonelStatusID,
           NeedConfirmation = @NeedConfirmation,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate,
           [Version] = @Version
    WHERE  [AgreementTypeID] = @AgreementTypeID
	
	-- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM   [HRM].[AgreementType]
    WHERE  [AgreementTypeID] = @AgreementTypeID 
    -- End Return Select <- do not remove
