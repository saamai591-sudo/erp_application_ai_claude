


create    PROC [PRM].[SpGetCostData]
(@CostCalculationID INT)
AS

DECLARE @EndDate                     DATE,
        @CostCalculationPeriodID     INT,
        @DocumentTypeID VARCHAR(500),
        @TableName1 VARCHAR(500),
        @TableName2 VARCHAR(500),
        @TableName3 VARCHAR(500)

SET @TableName1 = cfg.getTempTableName(1)
SET @TableName2 = cfg.getTempTableName(1)
SET @TableName3 = cfg.getTempTableName(1)

SELECT @CostCalculationPeriodID = CostCalculationPeriodID
FROM   PRM.CostCalculation AS cc
WHERE  cc.CostCalculationID = @CostCalculationID

SELECT @EndDate = enddate
FROM   prm.CostCalculationPeriod
WHERE  CostCalculationPeriodID = @CostCalculationPeriodID

SELECT @DocumentTypeID = pms.ConfigValue
 FROM prm.ProductionManagementSetting AS pms
WHERE pms.ConfigKey = 'DocumentType'

SELECT VoucherID
INTO   #Voucher
FROM   acc.Voucher AS v
       JOIN prm.CostCalculationPeriod AS ccp
            ON  v.[Date] BETWEEN ccp.StartDate AND ccp.EndDate
WHERE  ccp.CostCalculationPeriodID = @CostCalculationPeriodID
       AND v.DocumentTypeID IN (SELECT value
                                FROM   [CFG].[R_FnCommaStr2Table] (@DocumentTypeID))

SELECT *
INTO   #CostStructureAccount
FROM   (
           SELECT ROW_NUMBER() OVER(PARTITION BY cs.CostStructureID ORDER BY ccp.EndDate DESC) Rno,
                  csa.CostStructureAccountID
           FROM   prm.CostStructure AS cs
                  JOIN prm.CostStructureAccount AS csa
                       ON  csa.CostStructureID = cs.CostStructureID
                  JOIN prm.CostCalculationPeriod AS ccp
                       ON  ccp.CostCalculationPeriodID = csa.CostCalculationPeriodID
           WHERE  ccp.enddate <= @EndDate
       )A
WHERE  rno = 1

SELECT csai.SlID
INTO   #CostSl
FROM   #CostStructureAccount a
       JOIN prm.CostStructureAccountitem csai
            ON  csai.CostStructureAccountID = a.CostStructureAccountID


SELECT vi.VoucherItemid,
       vi.slid,
       debit,
       credit
INTO   #VoucherItem
FROM   #Voucher AS v
       JOIN acc.VoucherItem AS vi
            ON  v.VoucherID = vi.VoucherID
       JOIN #CostSl cs
            ON  cs.slid = vi.slid


DECLARE @AccountLevel     VARCHAR(MAX),
        @Query            VARCHAR(MAX),
        @CreateTable      VARCHAR(MAX)

SET @AccountLevel = STUFF(
        (
            SELECT ',' + QUOTENAME(AccountLevelID)
            FROM   acc.AccountLevel AS al
                   FOR XML PATH(''),
                   TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1,
        1,
        ''
    )
        
SET @CreateTable = STUFF(
        (
            SELECT ',' + QUOTENAME(AccountLevelID) + ' int'
            FROM   acc.AccountLevel AS al
                   FOR XML PATH(''),
                   TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1,
        1,
        ''
    )        
        
SET @Query = N'
 CREATE TABLE '+@TableName1+'
 (
 	slid INT,
 	' + @CreateTable + 
    '
 	,Value decimal(30,4)
 )
 
  CREATE TABLE '+@TableName2+'
 (
 	slid INT,
 	CostDataCollectionAccountSettingID int,
 	
 	' + @CreateTable + '
 )'
-- PRINT @Query
EXEC (@Query)
  --return
SET @Query = N'
insert into '+@TableName1+'
SELECT slid,' + @AccountLevel + 
    ',sum(debit - credit) Value
FROM
(
SELECT slid,alvi.AccountLevelID,alvi.DlID,debit,credit,vi.VoucherItemID
FROM #VoucherItem AS vi
LEFT JOIN acc.AccountLevelVoucherItem AS alvi
	ON vi.VoucherItemID = alvi.VoucherItemID
)X
PIVOT
(
MAX(DlID)
FOR AccountLevelID IN (' + @AccountLevel + ')
)p
group by slid,' + @AccountLevel
--	PRINT @Query
EXEC (@Query)
 
SET @Query = N' 
insert into '+@TableName2+'
select slid,CostDataCollectionAccountSettingID,' + @AccountLevel + 
    '
 from (
 SELECT slid,cdcdsi.AccountLevelID,cdcdsi.DlID,cdcas.CostDataCollectionAccountSettingID
FROM prm.CostStructureAccountitem csai
join prm.CostDataCollectionAccountSetting AS cdcas
ON cdcas.CostStructureAccountItemID = csai.CostStructureAccountItemID
LEFT JOIN prm.CostDataCollectionDlSetting AS cdcds
ON cdcds.CostDataCollectionAccountSettingID = cdcas.CostDataCollectionAccountSettingID
LEFT JOIN prm.CostDataCollectionDlSettingItem AS cdcdsi
ON cdcdsi.CostDataCollectionDlSettingID = cdcds.CostDataCollectionDlSettingID)x
pivot
(
MAX(DlID)
FOR AccountLevelID IN (' + @AccountLevel + ')
)p
'
--	PRINT @Query
EXEC (@Query)

SET @Query = N' 
CREATE TABLE '+@TableName3+'
(
	CostDataCollectionAccountSettingid     INT,
	[VALUE]                                DECIMAL(18, 0)
)'
EXEC (@Query)

SET @AccountLevel = STUFF(
        (
            SELECT ' and (b.' + QUOTENAME(AccountLevelID) + ' is null or a.' + QUOTENAME(AccountLevelID) + ' = b.' + 
                   QUOTENAME(AccountLevelID)
                   + ')'
            FROM   acc.AccountLevel AS al
                   FOR XML PATH(''),
                   TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1,
        0,
        ''
    )

SET @Query = N'insert into '+@TableName3+'      
 SELECT b.CostDataCollectionAccountSettingid,a.value FROM '+@TableName1+' a
 JOIN '+@TableName2+' b ON a.slid = b.slid'
    + @AccountLevel
 

EXEC (@Query)

SET @Query = N'
INSERT INTO [PRM].[CostCollectedData]
  (
    CostCalculationID,
    [CostDataCollectionAccountSettingID],
    [Value],
    Version,
    Creator,
    CreationDate,
    LastEditor,
    LastEditionDate
  )
SELECT '+cast(@CostCalculationID as VARCHAR(50))+',
       [CostDataCollectionAccountSettingID],
       [Value],
       0,
       -1,
       GETDATE(),
       -1,
       GETDATE()
FROM  '+@TableName3
EXEC (@Query)