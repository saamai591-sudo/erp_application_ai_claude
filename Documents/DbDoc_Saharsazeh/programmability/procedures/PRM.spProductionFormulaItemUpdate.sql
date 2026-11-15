

CREATE   PROC [PRM].[spProductionFormulaItemUpdate]
    @ProductionFormulaItemID int,  	
	@ProductionFormulaID int,
	@RowIndex smallint,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@EffectiveDate date,
	@IsActive bit,
	@IsMain bit,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionFormulaItem
	where ProductionFormulaItemID = @ProductionFormulaItemID)
	begin	

		set @Version = @Version +1 

		UPDATE PRM.ProductionFormulaItem
		SET    ProductionFormulaID = @ProductionFormulaID,
		       RowIndex = @RowIndex,
		       Title = @Title, 
			   Title2 = @Title2, 
			   EffectiveDate = @EffectiveDate,
			   IsActive = @IsActive,
			   IsMain = @IsMain,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionFormulaItemID = @ProductionFormulaItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionFormulaItem
		WHERE  ProductionFormulaItemID = @ProductionFormulaItemID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
