create proc [STM].[AssetCard_Insurance]
(
@AssetID nvarchar(max)
)

as
begin
select i.Number,cfg.GetSaturnDate(i.Date , 0) date,
p.Title + ' '+ISNULL(p.LastName , '') Party,ii.EstimatedValue
from ast.Insurance i
join ast.InsuranceItem ii on i.InsuranceID = ii.InsuranceID
join cfg.Party p on p.PartyID = i.PartyID
where ii.AssetID =   @AssetID
end
