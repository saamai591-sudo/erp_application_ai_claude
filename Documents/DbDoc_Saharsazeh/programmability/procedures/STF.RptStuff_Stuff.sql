
------------------------------------- END #8135
------------------------------------- START #8580
Create   PROC [STF].RptStuff_Stuff
(
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedPropertyTitle NVARCHAR(MAX) = NULL,
    @SelectedValueTitle NVARCHAR(MAX) = NULL,
    @SelectedFeature NVARCHAR(MAX) = NULL,
    @SelectedPursuitGroup NVARCHAR(MAX) = Null
)

--WITH ENCRYPTION 
AS
DECLARE @Culture       NVARCHAR(25),
        @CultureNo     TINYINT;

SET @Culture = CFG.GetuserCulture();
SELECT @CultureNo = ISNULL(CultureNo, 1)
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;


SELECT VALUE as PursuitGroupID into #SelectedPursuitGroup
FROM CFG.R_FnCommaStr2Table(@SelectedPursuitGroup)




SELECT vs.StuffID,
       vs.code                              StuffCode,
       CASE 
            WHEN @CultureNo = 2 THEN vs.Title2
            ELSE vs.Title
       END                               AS StuffTitle,
       vs.TechnicalCode,
       CASE 
            WHEN @CultureNo = 2 THEN vs.MainMeasureUnit2
            ELSE vs.MainMeasureUnit
       END                               AS MainMeasureUnitTitle,
       CASE 
            WHEN @CultureNo = 2 THEN vs.SubMeasureUnit2
            ELSE vs.SubMeasureUnit
       END                               AS SubMeasureUnitTitle,
       CASE 
            WHEN @CultureNo = 2 THEN vs.StuffAccountGroupTitle2
            ELSE vs.StuffAccountGroupTitle
       END                               AS StuffAccountGroupTitle,
       vs.Barcode,
       vs.IranCode,
       CASE 
            WHEN @CultureNo = 2 THEN vs.SalesGroupTitle2
            ELSE vs.SalesGroupTitle
       END                               AS SaleGroupTitle,
       CASE 
            WHEN @CultureNo = 2 THEN pg.Title2
            ELSE pg.Title
       END                               AS PurchaseGroupTitle,
       CASE 
            WHEN @CultureNo = 2 THEN dg.Title2
            ELSE dg.Title
       END                               AS DiscountGroupTitle,
       CASE 
            WHEN @CultureNo = 2 THEN cg.Title2
            ELSE cg.Title
       END                               AS CommissionGroupTitle,
       vs.IsSpecialStuff
FROM   STF.VWStuff                       AS vs
       LEFT JOIN STF.StuffDetail         AS sd
            ON  sd.StuffID = vs.StuffID
       LEFT JOIN CFG.[Group]             AS pg
            ON  pg.GroupID = sd.BuyGroupID
       LEFT JOIN CFG.[Group]             AS dg
            ON  dg.GroupID = vs.DiscountGroupID
       LEFT JOIN CFG.[Group]             AS cg
            ON  cg.GroupID = sd.CommissionGroupID
       LEFT JOIN STF.StuffTrace          AS st
            ON  st.StuffID = vs.StuffID
       LEFT JOIN STF.StuffPropertyValue  AS spv
            ON  spv.StuffID = vs.StuffID
WHERE ( @SelectedStuffGroup IS NULL
       OR  EXISTS
           (
               SELECT 1
               FROM   CFG.R_FnCommaStr2Table(@SelectedStuffGroup) AS rfcst
               WHERE  rfcst.value = vs.StuffGroupID
           ))
       AND (
               @SelectedPropertyTitle IS NULL
               OR EXISTS
                  (
                      SELECT 1
                      FROM   CFG.R_FnCommaStr2Table(@SelectedPropertyTitle) AS rfcst2
                      WHERE  rfcst2.value = spv.PropertyID
                  )
           )
       AND (
               @SelectedValueTitle IS NULL
               OR EXISTS
                  (
                      SELECT 1
                      FROM   CFG.R_FnCommaStr2Table(@SelectedValueTitle) AS rfcst3
                      WHERE  rfcst3.value = spv.PropertyID
                  )
           )
       AND (
               @SelectedFeature IS NULL
               OR EXISTS
                  (
                      SELECT 1
                      FROM   CFG.R_FnCommaStr2Table(@SelectedFeature) AS rfcst4
                      WHERE  rfcst4.value = st.TraceID
                  )
       )
        AND (
               @SelectedPursuitGroup IS NULL
               OR vs.StuffID IN 
                  (
                      SELECT spg.StuffID FROM stf.StuffPursuitGroup AS spg
                      join #SelectedPursuitGroup sel on spg.PursuitGroupID = sel.PursuitGroupID
                  )
           )
       ;
