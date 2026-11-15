
CREATE   VIEW PRM.vwRequiredProductNonRequested
as
SELECT rm.RequiredProductID,
       rm.RequiredQuantity,
       done,
       rm.RequiredQuantity - isnull(done,0) Non
FROM   prm.RequiredProduct              AS rm
LEFT JOIN 
(select RequiredProductID,sum(MainQuantity) done
from req.StuffRequestItem
GROUP BY RequiredProductID
)    AS sri
            ON  sri.RequiredProductID = rm.RequiredProductID
