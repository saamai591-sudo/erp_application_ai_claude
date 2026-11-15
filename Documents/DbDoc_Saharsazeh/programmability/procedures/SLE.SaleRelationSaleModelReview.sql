CREATE     PROCEDURE [SLE].SaleRelationSaleModelReview
(
    @BaseTypeId INT,
    @TypeId INT,
    @ShowSubmit BIT,
    @ShowConfirm BIT,
    @Fromdate DATE,
    @ToDate DATE,
    @BranchIds VARCHAR(MAX) = NULL,
    @DlIds VARCHAR(MAX) = NULL,
    @StuffIds NVARCHAR(MAX) = NULL,
    @SaleTypeIds VARCHAR(MAX) = NULL,
    @SaleGroupIds VARCHAR(MAX) = NULL,
    @StuffGroupIds VARCHAR(MAX) = NULL,
    @DocumentIds VARCHAR(MAX) = NULL,
	@SaleAreaIds VARCHAR(MAX) = NULL
)
AS
CREATE TABLE #Stuffs
(
    [value] BIGINT
);


SELECT rfcst.[value]
INTO #Branches
FROM CFG.R_FnCommaStr2Table(@BranchIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleAreas
FROM CFG.R_FnCommaStr2Table(@SaleAreaIds) AS rfcst;

SELECT rfcst.[value]
INTO #Dls
FROM CFG.R_FnCommaStr2Table(@DlIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleTypes
FROM CFG.R_FnCommaStr2Table(@SaleTypeIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleGroups
FROM CFG.R_FnCommaStr2Table(@SaleGroupIds) AS rfcst;

SELECT rfcst.[value]
INTO #StuffGroups
FROM CFG.R_FnCommaStr2Table(@StuffGroupIds) AS rfcst;

SELECT rfcst.[value]
INTO #Documents
FROM CFG.R_FnCommaStr2Table(@DocumentIds) AS rfcst;


SELECT b.SaleModelID,
       b.Code,
       b.Title,
       b.Title2,
       T1.BaseMainQuantity,
       T1.BaseSubQuantity,
       T1.MainQuantity,
       T1.SubQuantity,
       T1.BaseMainQuantity - ISNULL(MainQuantity, 0) AS MainRemain,
       T1.BaseSubQuantity - ISNULL(SubQuantity, 0) AS SubRemain
FROM
(
    SELECT SaleModelID,
           SUM(   CASE
                      WHEN Rno = 1 THEN
                          BaseMainQuantity
                      ELSE
                          0
                  END
              ) AS BaseMainQuantity,
           SUM(   CASE
                      WHEN Rno = 1 THEN
                          BaseSubQuantity
                      ELSE
                          0
                  END
              ) AS BaseSubQuantity,
           SUM(   CASE
                      WHEN ChildId IS NULL THEN
                          0
                      WHEN T.ParentId IS NOT NULL THEN
                          T.BaseMainQuantity
                      ELSE
                          MainQuantity
                  END
              ) AS MainQuantity,
           SUM(   CASE
                      WHEN ChildId IS NULL THEN
                          0
                      WHEN T.ParentId IS NOT NULL THEN
                          T.BaseSubQuantity
                      ELSE
                          SubQuantity
                  END
              ) AS SubQuantity
    FROM
    (
        SELECT SaleModelID,
               fsi.BaseMainQuantity,
               fsi.BaseSubQuantity,
               fsi.MainQuantity,
               fsi.SubQuantity,
               Parent.Id AS ParentId,
               Child.Id AS ChildId,
               ROW_NUMBER() OVER (PARTITION BY Parent.Id ORDER BY Parent.Id) AS Rno
        FROM
        (
            SELECT ItemId,
                   Id,
                   SaleModel AS SaleModelID
            FROM APS.DimSaleItem dsi
                INNER JOIN STF.[Stuff] AS s
                    ON s.StuffID = dsi.StuffID
                INNER JOIN STF.StuffDetail AS sd
                    ON sd.StuffID = s.StuffID
                LEFT JOIN #Branches AS b
                    ON b.value = dsi.BranchID
				LEFT JOIN #SaleAreas AS sa
                    ON sa.value = dsi.SaleAreaID
                LEFT JOIN #Dls AS b1
                    ON b1.value = dsi.DlID
                LEFT JOIN #Stuffs AS b2
                    ON b2.value = dsi.Id
                LEFT JOIN #SaleTypes AS b3
                    ON b3.value = dsi.SaleTypeID
                LEFT JOIN #SaleGroups AS b5
                    ON b5.value = sd.SalesGroupID
                LEFT JOIN #StuffGroups AS b6
                    ON b6.value = s.StuffGroupID
                LEFT JOIN #Documents AS b7
                    ON b7.value = dsi.DocumentID
            WHERE ItemType = @BaseTypeId
                  AND [Date]
                  BETWEEN @Fromdate AND @ToDate
                  AND
                  (
                      @BranchIds IS NULL
                      OR b.value IS NOT NULL
                  )
				   AND
                  (
                      @SaleAreaIds IS NULL
                      OR sa.value IS NOT NULL
                  )
                  AND
                  (
                      @DlIds IS NULL
                      OR b1.value IS NOT NULL
                  )
                  AND
                  (
                      @StuffIds IS NULL
                      OR b2.value IS NOT NULL
                  )
                  AND
                  (
                      @SaleTypeIds IS NULL
                      OR b3.value IS NOT NULL
                  )
                  -- AND (@SalemodelIds IS NULL OR b4.Value IS NOT NULL)
                  AND
                  (
                      @SaleGroupIds IS NULL
                      OR b5.value IS NOT NULL
                  )
                  AND
                  (
                      @StuffGroupIds IS NULL
                      OR b6.value IS NOT NULL
                  )
                  AND
                  (
                      @DocumentIds IS NULL
                      OR b7.value IS NOT NULL
                  )
                  AND
                  (
                      dsi.[Status] IS NULL
                      OR
                      (
                          @ShowSubmit = 1
                          AND dsi.[Status] = 1
                      )
                      OR
                      (
                          @ShowConfirm = 1
                          AND dsi.[Status] = 3
                      )
                  )
        ) Parent
            INNER JOIN APS.FactSaleItem AS fsi
                ON fsi.ParentId = Parent.Id
            LEFT JOIN
            (
                SELECT APS.DimSaleItem.ItemId,
                       APS.DimSaleItem.Id
                FROM APS.DimSaleItem
                WHERE ItemType = @TypeId
            ) Child
                ON Child.Id = fsi.ChildId
    ) T
    GROUP BY SaleModelID
) T1
    INNER JOIN SLE.SaleModel AS b
        ON b.SaleModelID = T1.SaleModelID;

