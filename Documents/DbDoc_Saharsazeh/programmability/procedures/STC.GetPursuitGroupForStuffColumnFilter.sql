CREATE   PROCEDURE STC.GetPursuitGroupForStuffColumnFilter
(
    @stockid INT
)
--WITH ENCRYPTION
AS
BEGIN
    -- change because mr hassanZadeh says

    SELECT DISTINCT
           PursuitGroupID
    INTO #stockPursuitGroups
    FROM STF.PursuitGroupStock
    WHERE StockID = @stockid;


    IF NOT EXISTS (SELECT 1 FROM #stockPursuitGroups)
    BEGIN
        SELECT -1;
    END;
    ELSE
    BEGIN

        SELECT p.PursuitGroupID
        FROM STF.PursuitGroup p
            LEFT JOIN #stockPursuitGroups s
                ON s.PursuitGroupID = p.PursuitGroupID
        WHERE (
              (
                  SELECT COUNT(1)FROM #stockPursuitGroups
              ) = 0
              OR  s.PursuitGroupID IS NOT NULL
              );
    END;
END;
