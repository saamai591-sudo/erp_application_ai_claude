
CREATE   VIEW [PRM].[vwRequiredMaterialNonRequested]
as
SELECT rm.RequiredMaterialCostCenterID,
       rm.RequiredQuantity,
       done,
       rm.RequiredQuantity - isnull(done,0) Non
FROM   prm.RequiredMaterialCostCenter              AS rm
       LEFT JOIN 
	   (select RequiredMaterialCostCenterID,sum(MainQuantity) done
	   from req.StuffRequestItem
	   GROUP BY RequiredMaterialCostCenterID
	   )    AS sri
            ON  sri.RequiredMaterialCostCenterID = rm.RequiredMaterialCostCenterID
