


CREATE VIEW [ACC].[vwSl2]

AS 


SELECT *,
       Acc.SlFullCode(Acc.SlGroupId(SlID)) AS PLFullCode,
       Acc.SlTitle(Acc.SlGroupId(SlID), 0) AS PlTitle,
       Acc.SlTitle(Acc.SlGroupId(SlID), 1) AS PlTitle2
FROM   Acc.vwSl AS vs

