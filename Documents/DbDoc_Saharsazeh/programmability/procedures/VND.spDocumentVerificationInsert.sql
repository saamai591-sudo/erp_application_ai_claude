CREATE     PROC [VND].[spDocumentVerificationInsert] 
	@Number int  ,
	@Date Date  ,
	@BaseType tinyint  ,
	@BaseID int  ,
	@DocumentVerificationPathItemID int  ,
	@Description nvarchar(max)  ,
	@Description2 nvarchar(max)  ,
    @Creator INT,
    @CreationDate DATETIME
AS 
	SET NOCOUNT ON 

	select @Number = isnull(max(Number),0) + 1
	from VND.DocumentVerification
	
	INSERT INTO VND.DocumentVerification (Number, Date,BaseType,BaseID,DocumentVerificationPathItemID,Description,Description2, Version, Creator, CreationDate, LastEditor, LastEditionDate)
	SELECT @Number , @Date,@BaseType,@BaseID,@DocumentVerificationPathItemID,@Description,@Description2, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	SELECT DocumentVerificationID, Version
	FROM   VND.DocumentVerification
	WHERE  DocumentVerificationID = SCOPE_IDENTITY()
