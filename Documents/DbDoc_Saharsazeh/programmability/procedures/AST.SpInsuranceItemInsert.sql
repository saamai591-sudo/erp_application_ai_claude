CREATE   PROC [AST].[SpInsuranceItemInsert] 
    @InsuranceID int,
    @AssetID int,
    @EstimatedValue decimal(30, 4),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	
	INSERT INTO [AST].[InsuranceItem] ([InsuranceID], [AssetID], [EstimatedValue], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @InsuranceID, @AssetID, @EstimatedValue, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [InsuranceItemID], [Version]
	FROM   [AST].[InsuranceItem]
	WHERE  [InsuranceItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
