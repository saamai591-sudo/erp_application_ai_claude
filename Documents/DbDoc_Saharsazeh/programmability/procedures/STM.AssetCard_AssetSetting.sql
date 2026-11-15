-------------------------------------
create    proc [STM].[AssetCard_AssetSetting]
(
@AssetID nvarchar(max)
)

as
begin
select  cfg.GetSaturnDate(ass.Date,0) Date,
		b.Code BranchCode,
		b.Title BranchTitle,
		p1.Title + ' ' + ISNULL(p1.LastName,'') Responsible,
		p2.Title + ' ' + ISNULL(p2.LastName,'') Deliverer,
		d.Title DeployPlace,
		case ass.status when 1 then 'درحال استفاده'
						when 2 then 'بلااستفاده'
				end status

from ast.AssetSetting ass
join AST.Asset a on ass.AssetID = a.AssetID
join cfg.Branch b on b.BranchID = a.BranchID
left join cfg.Party p1 on p1.PartyID = ass.Responsible
left join cfg.Party p2 on p2.PartyID = ass.Deliverer
left join ast.DeployPlace d on d.DeployPlaceID = ass.DeployPlaceID
where ass.AssetID  = @AssetID
end
