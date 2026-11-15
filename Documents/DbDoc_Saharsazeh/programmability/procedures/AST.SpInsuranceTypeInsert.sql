CREATE PROC [AST].[SpInsuranceTypeInsert] 
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@InsuranceCost int = null,
	@PrepaidInsurance int = null,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [AST].[InsuranceType] ([Title], [Title2], [InsuranceCost], [PrepaidInsurance], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Title, @Title2, @InsuranceCost, @PrepaidInsurance, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [InsuranceTypeID], [Version]
	FROM   [AST].[InsuranceType]
	WHERE  [InsuranceTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
