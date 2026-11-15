CREATE PROC [STF].RptStuff_StuffGroup
AS
DECLARE @Culture NVARCHAR(25),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();
SELECT @CultureNo = ISNULL(CultureNo, 1)
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT StuffGroupID,
       ParentID,
       Code,
       CASE
           WHEN @CultureNo = 1 THEN
               sg.Title
           WHEN @CultureNo = 2 THEN
               sg.Title2
       END AS Title
FROM STF.StuffGroup sg;
