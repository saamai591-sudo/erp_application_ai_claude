-------------------------------------
create    PROCEDURE [MDT].[GetEntityList]
(@Query VARCHAR(MAX) = NULL)
AS
BEGIN

    DECLARE @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();

with cte as(
	SELECT dt.ID, dt.[Name]  , dc.[Name] ColumnName 

	FROM MDT.DmdTable AS dt
	JOIN MDT.DmdColumn AS dc ON dc.TableName = dt.[Name]
			AND dc.TableSchema = dt.[Schema]
			AND dc.IsKey = 1
			)
    SELECT de.ID,
           de.[Name] AS EntityKey,
           dti.[Value] AS EntityTitle,
           dm.[Name] AS ModuleKey,
           dti1.[Value] AS ModuleTitle,
           dd.[Name] AS MainTable,
           dd.[ColumnName] AS MainTableKey,
           JSON_VALUE(de.Attributes, '$.SubEntities') AS SubEntities,
           '' as EntitySubKey,
           '' as BaseEntityKey
    FROM MDT.DmdEntity AS de
        JOIN MDT.DmdRelatedEntityTranslate AS dret
            ON dret.DmdEntityID = de.ID
        JOIN MDT.DmdTranslateItem AS dti
            ON dti.ID = dret.DmdTranslateItemID
        JOIN MDT.DmdModule AS dm
            ON dm.ID = de.DmdModuleID
        JOIN MDT.DmdRelatedModuleTranslate AS drmt
            ON drmt.DmdModuleID = dm.ID
        JOIN MDT.DmdTranslateItem AS dti1
            ON dti1.ID = drmt.DmdTranslateItemID
        JOIN MDT.DmdEntityTableRelation AS detr
            ON detr.DmdEntityID = dret.DmdEntityID
        JOIN  cte as dd on dd.ID = detr.DmdTableID
    WHERE dti.Culture = @Culture
          AND dti1.Culture = @Culture
          AND detr.RelationType = 1
          AND
          (
              @Query IS NULL
              OR JSON_VALUE(de.Attributes, '$.' + @Query) = 'true'
          )
    --ORDER BY de.ID;

END;
