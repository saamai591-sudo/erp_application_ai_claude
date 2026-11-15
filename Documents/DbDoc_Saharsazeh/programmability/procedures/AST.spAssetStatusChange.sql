------------------------------------- 
CREATE     PROC AST.spAssetStatusChange
(
 @entity NVARCHAR(50),
 @entityIds nvarchar(max),
 @status tinyint
)
--WITH ENCRYPTION
AS
BEGIN
	
	IF OBJECT_ID('tempdb..#Ids') IS Not NULL
		DROP TABLE #Ids

	create table #Ids
	(
	 ID int
	)

	insert into #Ids
	select value
	from [CFG].[Split] (@entityIds,',')

	if (@entity = 'Transfer')
	begin

		update a set Status = @status
		from AST.TransferItem i
		join AST.Asset a on i.AssetID = a.AssetID
		where i.TransferID in (select ID from #Ids)
	
	end

	if (@entity = 'ChangeCategory')
	begin
		
		update a set AssetCategoryID = i.PreviousCategoryID
        from AST.ChangeCategoryItem i
        join AST.ChangeCategory c on i.ChangeCategoryID = c.ChangeCategoryID
        join AST.Asset a on i.AssetID = a.AssetID
        where i.ChangeCategoryID in (select ID from #Ids)

	end

	if (@entity = 'Destruction')
	begin

		update a set Status = @status
		from AST.DestructionItem i
		join AST.Asset a on i.AssetID = a.AssetID
		where i.DestructionID in (select ID from #Ids)

	end

	if (@entity = 'Sale')
	begin
		
		update a set Status = @status
		from AST.SaleItem i
		join AST.Sale s on i.SaleID = s.SaleID
		join AST.Asset a on i.AssetID = a.AssetID
		where i.SaleID in (select ID from #Ids)

	end

	if (@entity = 'Salvage')
	begin
		
		update a set Status = @status
		from AST.SalvageItem i
		join AST.Asset a on i.AssetID = a.AssetID
		where i.SalvageID in (select ID from #Ids)

	end

	IF OBJECT_ID('tempdb..#Ids') IS Not NULL
		DROP TABLE #Ids

END
