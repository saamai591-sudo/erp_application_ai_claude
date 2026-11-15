create proc [STM].[AssetCard_Statemeent]
(
@AssetID nvarchar(max)
)

as
begin

select S.Number,cfg.GetSaturnDate(S.Date , 0) date,
P.Title+ ' '+ ISNULL(P.lastname,'') Visitor,u.Title UtilizationStatus
from ast.Statement s
join ast.StatementItem si on s.StatementID = si.StatementID
JOIN CFG.Party P ON P.PartyID = S.PartyID
join ast.UtilizationStatus u on u.UtilizationStatusID = si.UtilizationStatusID
where si.AssetID =  @AssetID
end
