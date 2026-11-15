
create   view [ACC].[vwAccountLevelSL]
as
select SlID,
		AccountLevelID,
		dt.Code DlTypeCode
from acc.AccountLevelSL als
join acc.DlType dt on dt.DlTypeID = als.DlTypeID