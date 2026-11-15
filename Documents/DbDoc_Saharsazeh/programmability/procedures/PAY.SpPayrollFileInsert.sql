CREATE   PROC [PAY].[SpPayrollFileInsert] 
    @IsOrgan BIT,
    @Title NVARCHAR(512),
    @Title2 NVARCHAR(512),
    @OrganizationID INT = NULL,
    @BankID INT = NULL,
    @Seprator VARCHAR(5) = NULL,
    @FileName NVARCHAR(128),
    @FileItemName NVARCHAR(512) = NULL,
    @FileType VARCHAR(50),
    @FileExt VARCHAR(50),
    @HasSeprateItem BIT,
    @FileHasHeader BIT,
    @PaymentTopicID TINYINT,
    @EncodingType TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON 
	
	IF EXISTS(
	       SELECT *
	       FROM   PAY.PayrollFile p
	       WHERE  p.Title = @Title
	   )
	BEGIN
	    RAISERROR('عنوان نمی تواند تکراری باشد.', 16, 12)
	END 
	
	INSERT INTO [PAY].[PayrollFile]
	  (
	    [IsOrgan],
	    [Title],
	    [Title2],
	    [OrganizationID],
	    [BankID],
	    [Seprator],
	    [FileName],
	    [FileItemName],
	    [FileType],
	    [FileExt],
	    [HasSeprateItem],
	    FileHasHeader,
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    [Version],
	    PaymentTopicID,
	    EncodingType 
	  )
	SELECT @IsOrgan,
	       @Title,
	       @Title2,
	       @OrganizationID,
	       @BankID,
	       @Seprator,
	       @FileName,
	       @FileItemName,
	       @FileType,
	       @FileExt,
	       @HasSeprateItem,
	       @FileHasHeader,
	       @Creator,
	       @CreationDate,
	       @LastEditor,
	       @LastEditionDate,
	       0,
	       @PaymentTopicID,
	       @EncodingType 
	
	-- Begin Return Select <- do not remove
	SELECT [PayrollFileID],
	       [Version]
	FROM   [PAY].[PayrollFile]
	WHERE  [PayrollFileID] = SCOPE_IDENTITY()
	       -- End Return Select <- do not remove
END
