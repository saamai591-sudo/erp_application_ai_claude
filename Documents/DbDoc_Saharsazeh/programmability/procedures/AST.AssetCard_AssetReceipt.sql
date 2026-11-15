-------------------------------------
CREATE   proc [AST].AssetCard_AssetReceipt
(
	@AssetID int
)
--WITH ENCRYPTION 
as
begin

declare 
		@Culture NVARCHAR(100),
		@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture


SELECT *,row_number() OVER (PARTITION BY ve.Enum,ve.Item ORDER BY ve.Enum,ve.Item) rno into #vwEnums FROM cfg.VwEnums AS ve
WHERE ve.Enum IN ( 'AssetType','DepreciationMethod','AssetStatus', 'CreationType', 'AssetReceiptBaseType')

select 
	a.Plaque,
	case @CultureNo 
		when 1 then a.Title
		when 2 then a.Title2
	end as Title,
	ve.[Value] as  AssetType,
ac.Title AssetCategory,
ar.Number AssetReceiptNumber,
cfg.GetSaturnDate(a.AssetCreationDate,0) AssetCreationDate,
ve1.[Value] CreationType,
ve4.[Value] BaseType,
a.BaseValue,
a.AccumulatedDepreciation,
a.SalvageValue,
ve3.[Value] status,
ve2.[Value] DepreciationMethod, 
a.DepreciationRate,

case when a.HeadAssetID is null then N'اصلی' else N'فرعی' end MainOrSubType,
a2.Plaque + ' - '+ case @CultureNo 
						when 1 then a2.Title
						when 2 then a2.Title2
					end HeadAsset 
from ast.Asset a
	LEFT join #VwEnums AS ve on a.AssetType = ve.KeyValue and ve.rno = 1 and ve.enum = 'AssetType'
	left join #VwEnums AS ve3 on a.AssetType = ISNULL(ve3.KeyValue,100) and ve3.rno = 1 and ve3.enum = 'AssetStatus'
	LEFT join ast.AssetReceipt ar on ar.AssetReceiptID = a.AssetReceiptID
	left join #VwEnums AS ve1 on ar.CreationType = ve1.KeyValue and ve1.rno = 1 and ve1.enum = 'CreationType'
	left join #VwEnums AS ve4 on ar.BaseType = ve4.KeyValue and ve4.rno = 1 and ve4.enum = 'AssetReceiptBaseType'
	LEFT join ast.AssetCategory ac on a.AssetCategoryID = ac.AssetCategoryID
	left join #VwEnums AS ve2 on a.DepreciationMethod = ISNULL(ve2.KeyValue,100) and ve2.rno = 1 and ve2.enum = 'DepreciationMethod'
	left join ast.Asset a2 on a2.AssetID = a.HeadAssetID
where a.AssetID = @AssetID

end
