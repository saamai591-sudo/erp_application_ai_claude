CREATE   PROC [AST].[SpInsuranceItemUpdate] 
    @InsuranceItemID int,
    @InsuranceID int,
    @AssetID int,
    @EstimatedValue decimal(30, 4),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[InsuranceItem]
				where [InsuranceItemID] = @InsuranceItemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end


	set @Version = @Version +1 

		UPDATE [AST].[InsuranceItem]
		SET    [InsuranceID] = @InsuranceID, [AssetID] = @AssetID, [EstimatedValue] = @EstimatedValue, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [InsuranceItemID] = @InsuranceItemID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [AST].[InsuranceItem]
		WHERE  [InsuranceItemID] = @InsuranceItemID	
		-- End Return Select <- do not remove
