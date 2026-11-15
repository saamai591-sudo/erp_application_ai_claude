/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 8/31/2019 11:20:21 AM
 ************************************************************/

Create PROCEDURE [CFG].[DeleteEntityCustomeFieldData](@EntityEngName VARCHAR(50), @EntityID BIGINT)
AS
	DELETE cfg.EntityCustomeFieldData
	FROM   cfg.EntityCustomeFieldData
	       INNER JOIN CFG.EntityCustomeField AS ecf
	            ON  ecf.EntityCustomeFieldID = cfg.EntityCustomeFieldData.EntityCustomeFieldID
	WHERE  cfg.EntityCustomeFieldData.EntityID = @EntityID
	       AND ecf.EntityName = @EntityEngName