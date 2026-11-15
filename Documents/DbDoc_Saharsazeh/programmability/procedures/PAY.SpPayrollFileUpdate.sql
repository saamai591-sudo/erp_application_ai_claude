CREATE PROC [PAY].[SpPayrollFileUpdate] 
    @PayrollFileID INT,
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
    @LastEditionDate DATETIME,
    @Version INT

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 

	IF @Version <> (
	       SELECT [Version]
	       FROM   [PAY].[PayrollFile]
	       WHERE  [PayrollFileID] = @PayrollFileID
	   )
	    RAISERROR('Version mismatch...', 16, 10)
	
	SET @Version = @Version + 1 
	
	IF EXISTS(
	       SELECT 1
	       FROM   PAY.PayrollFile p
	       WHERE  p.Title = @Title
	              AND p.PayrollFileID <> @PayrollFileID
	   )
	BEGIN
	    RAISERROR('عنوان نمی تواند تکراری باشد.', 16, 12)
	END
	
	UPDATE [PAY].[PayrollFile]
	SET    [IsOrgan] = @IsOrgan,
	       [Title] = @Title,
	       [Title2] = @Title2,
	       [OrganizationID] = @OrganizationID,
	       [BankID] = @BankID,
	       [Seprator] = @Seprator,
	       [FileName] = @FileName,
	       [FileItemName] = @FileItemName,
	       [FileType] = @FileType,
	       [FileExt] = @FileExt,
	       [HasSeprateItem] = @HasSeprateItem,
	       FileHasHeader = @FileHasHeader,
	       EncodingType = @EncodingType ,
	       [Creator] = @Creator,
	       [CreationDate] = @CreationDate,
	       [LastEditor] = @LastEditor,
	       [LastEditionDate] = @LastEditionDate,
	       [Version] = @Version,
	       PaymentTopicID = @PaymentTopicID
	WHERE  [PayrollFileID] = @PayrollFileID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
    FROM   [PAY].[PayrollFile]
	WHERE  [PayrollFileID] = @PayrollFileID 
	-- End Return Select <- do not remove
