

create    view [CFG].[vwphone]
as

select PartyID,[1] FixPhone,[3] Fax,[2] Mobile, isnull(isnull([4],[1]),[2])  Phone 
from (
select PartyID,Phone,Nature
	from CFG.Phone phs
	join CFG.AddressType t on phs.AddressTypeID = t.AddressTypeID
)X
	pivot
	(
	max(phone)
	for nature in ([1],[2],[3],[4])
	)p
