------------------------------------- 
CREATE    PROC [AST].[GetAssetsForChangeCategory]
(
	@branchId int,
	@assetCategoryId int
)
--WITH ENCRYPTION
AS
DECLARE @Culture NVARCHAR(100),
		@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT  a.AssetID,
            a.Plaque,
			case @CultureNo 
				when 1 then a.Title
				when 2 then a.Title2
			end as Title,
            a.AssetCategoryID,
			case @CultureNo 
				when 1 then ac.Title
				when 2 then ac.Title2
			end as AssetCategoryTitle,
            ISNULL(ac.ParentCode, '') + ac.Code AssetCategoryCode
           
    FROM AST.Asset a
    JOIN AST.AssetCategory ac ON a.AssetCategoryID = ac.AssetCategoryID
    WHERE a.[Status] = 1 and
	      a.BranchID = @branchId and
		  a.AssetCategoryID <> @assetCategoryId

