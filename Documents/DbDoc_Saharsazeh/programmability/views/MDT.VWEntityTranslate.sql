-------------------------------------
create   view MDT.VWEntityTranslate
as

select e.Name,t.Culture,t.Value
from MDT.DmdEntity e
join MDT.DmdRelatedEntityTranslate r on r.DmdEntityID = e.ID
join MDT.DmdTranslateItem t on t.ID = r.DmdTranslateItemID

