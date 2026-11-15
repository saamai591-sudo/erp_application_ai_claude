------------------------------------- 
CREATE    PROC [AST].[GetAssets]
(
	@id int = null,
	@assetType tinyint = NULL
)
--WITH ENCRYPTION
AS
DECLARE @Culture NVARCHAR(100),
		@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    select a.AssetID,
	       a.Plaque,
		   case @CultureNo 
				when 1 then a.Title
				when 2 then a.Title2
		   end as Title,
		   a.BranchID
    from AST.Asset a
    WHERE a.[Status] = 1 and
	     (@id is null or a.AssetID <> @id) and 
		 (@assetType is null or a.AssetType = @assetType)
