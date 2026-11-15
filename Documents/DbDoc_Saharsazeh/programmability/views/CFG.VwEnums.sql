-------------------------------------
CREATE   VIEW CFG.VwEnums
AS

with cte as (select cfg.GetuserCulture() UserCulture),
cte2 as (select * from cfg.CultureInfo ci
join cte c on ci.Culture = c.UserCulture)



	SELECT h.Enum, h.Item, h.KeyValue, i.[Value] FROM CFG.LocalizeEnum h
		JOIN CFG.LocalizeEnumValue i
			ON h.LocalizeEnumID = i.LocalizeEnumID
			cross join cte c
			where  i.Culture = c.UserCulture
			--option (Recompile)
	union all

select 'SystemEntities' Enum, e.Name,Null,t.Value
from MDT.DmdEntity e
join MDT.DmdRelatedEntityTranslate r on r.DmdEntityID = e.ID
join MDT.DmdTranslateItem t on t.ID = r.DmdTranslateItemID
cross join cte2 c 
where  t.Culture = c.Culture

