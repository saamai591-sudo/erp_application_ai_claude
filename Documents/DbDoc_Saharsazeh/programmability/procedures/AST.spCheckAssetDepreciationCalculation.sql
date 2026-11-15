

create    PROCEDURE [AST].[spCheckAssetDepreciationCalculation]
(
@AssetIDs varchar(max),
@Date date,
@Message varchar(100) output
)
AS
BEGIN

	select * 
	into #Ids
	from [CFG].[Split] (@AssetIDs,',')

	select AssetID, max(Date) Date
	into #Depreciations
	from AST.Depreciation
	group by AssetID

	if exists (select 1
		       from #Depreciations 
		       where Date > @Date and AssetID in (select value from #Ids))
	begin
		set @Message = 'AssetHasDepreciationCalculation'		 
		return
	end

END
	


