CREATE PROC [HRM].[SpOccupationGradeInsert] 
    @PaymentSystemID int,
    @Code varchar(50),
    @Title nvarchar(512),
    @Title2 nvarchar(512),
    @Value int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	IF exists(SELECT * FROM hrm.OccupationGrade  pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Title=@Title  )
	BEGIN
		RAISERROR('عنوان رتبه تکراري مي باشد.',16,12)
		RETURN
	END
	IF exists(SELECT * FROM hrm.OccupationGrade pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Code=@Code )
	BEGIN
		RAISERROR('کد رتبه تکراري مي باشد.',16,12)
		RETURN
	END
	
	INSERT INTO [HRM].[OccupationGrade] ([PaymentSystemID], [Code], [Title], [Title2], [Value], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @PaymentSystemID, @Code, @Title, @Title2, @Value, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [OccupationGradeID], [Version]
	FROM   [HRM].[OccupationGrade]
	WHERE  [OccupationGradeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
