create proc [STM].[AssetCard_Revalutaion]
(
@AssetID nvarchar(max)
)

as
begin

select r.Number,cfg.GetSaturnDate(r.Date , 0) date,
r.Description + case when ri.LifeTime is not null then ' عمر مفید '+cast(ri.LifeTime as varchar(20))+' برآورد شد.' else '' end Description,
ri.Value
from ast.Revaluation r
join ast.RevaluationItem ri on r.RevaluationID = ri.RevaluationID
where ri.AssetID =  @AssetID
end
