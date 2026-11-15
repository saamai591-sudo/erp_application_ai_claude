
CREATE   VIEW STF.vwStuffStock_ForPursuiteGroup
as 

WITH vwStuff as (
		 SELECT v.StuffID
		 FROM   stf.VWStuff AS v
	 )
	 SELECT * FROM (
SELECT vs.StuffID,pgs.StockID
FROM   stf.StuffPursuitGroup       AS spg
	   JOIN vwStuff                AS vs
			ON  vs.StuffID = spg.StuffID
	   JOIN stf.PursuitGroupStock  AS pgs
			ON  pgs.PursuitGroupID = spg.PursuitGroupID
			
UNION ALL
SELECT vs.StuffID,Null As StockID FROM vwStuff AS vs
left join stf.StuffPursuitGroup AS spg on spg.StuffID = vs.StuffID
WHERE spg.StuffID is null
	 ) a
	 GROUP BY a.stuffid,a.stockid
