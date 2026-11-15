
------------------------------------------------------------ START #7765
CREATE   PROC [STF].[RptStuff_PursuitGroup]
(
    @SelectedStuffId nvarchar(max) = null
)
--WITH ENCRYPTION 
AS
DECLARE @Culture NVARCHAR(25),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();
SELECT @CultureNo = ISNULL(CultureNo, 1)
FROM CFG.CultureInfo
WHERE Culture = @Culture;

select StuffId=try_cast([VALUE] as int) into #StuffIds 
from cfg.R_FnStr2TableBySplitor(@SelectedStuffId,',') 
where try_cast([VALUE] as int) is not null

SELECT DISTINCT
      spg.PursuitGroupID,
      pgi.Code,
       CASE
           WHEN @CultureNo = 2 THEN
              pgi.Title2
           ELSE
               pgi.Title
       END AS PursuitGroupTitle
FROM stf.StuffPursuitGroup AS spg
join stf.PursuitGroup pgi on spg.PursuitGroupID = pgi.PursuitGroupID 
where (ISNULL(@SelectedStuffId,'')='' or exists ( select * from #StuffIds s where s.StuffId= spg.StuffID ));
