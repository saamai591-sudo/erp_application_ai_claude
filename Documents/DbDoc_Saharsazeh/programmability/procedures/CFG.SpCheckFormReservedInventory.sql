
CREATE   PROC [CFG].SpCheckFormReservedInventory
(
    @ID NVARCHAR(500),
    @EntityName NVARCHAR(500),
    @Confirmed INT
)
--WITH ENCRYPTION
AS
BEGIN
    --@Confirmed documentation
    --@Confirmed = 1 => not assinged
    --@Confirmed = 2 => confirmed
    --@Confirmed = 3 => not confirmed

    IF EXISTS
    (
        SELECT c.ConfigValue
        FROM CFG.[Configuration] AS c
        WHERE c.ConfigKey = 'ReservedStoreIsControlable'
              AND c.ConfigValue = 'false'
    )
       AND EXISTS
    (
        SELECT c.ConfigValue
        FROM CFG.[Configuration] AS c
        WHERE c.ConfigKey = 'ConsumeReservedStoreIsControlable'
              AND c.ConfigValue = 'false'
    )
    BEGIN
        RETURN;
    END;

    IF EXISTS
    (
        SELECT c.ConfigValue
        FROM CFG.[Configuration] AS c
        WHERE c.ConfigKey = 'ControlReserved'
              AND c.ConfigValue = 'false'
    )
       AND EXISTS
    (
        SELECT c.ConfigValue
        FROM CFG.[Configuration] AS c
        WHERE c.ConfigKey = 'ConsumeControlReserved'
              AND c.ConfigValue = 'false'
    )
    BEGIN
        RETURN;
    END;

    DECLARE @Culture NVARCHAR(5),
            @CultureNo TINYINT,
			@Date date;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
	set @Date = cast(getdate() as Date)

    IF OBJECT_ID('tempdb..##SaleTempDb') IS NOT NULL
        DROP TABLE ##SaleTempDb;

    ----------------
    DECLARE @Query NVARCHAR(MAX),
            @TableName1 NVARCHAR(20),
            @Columns NVARCHAR(MAX),
            @FinancialPeriodID INT,
            @Type BIT,
            @branchID INT,
            @SelectColumns NVARCHAR(MAX),
            @joinColumns NVARCHAR(MAX),
            @controlType INT;

    DECLARE @stuffIds TABLE
    (
        StuffId INT
    );

    IF @EntityName = 'StuffRequest'
    BEGIN

        SELECT @controlType = CAST(c.ConfigValue AS INT)
        FROM CFG.Configuration AS c
        WHERE c.ConfigKey = 'ConsumeReservedControlType';

    END;
    ELSE
    BEGIN

        SELECT @controlType = CAST(c.ConfigValue AS INT)
        FROM CFG.Configuration AS c
        WHERE c.ConfigKey = 'ReservedControlType';

    END;

    IF (@EntityName = 'Justification')
    BEGIN

        SELECT TOP (1)
               @FinancialPeriodID = h.FinancialPeriodID,
               @branchID = h.BranchID
        FROM SLE.Justification h
            JOIN SLE.JustificationItem i
                ON h.JustificationID = i.JustificationID
        WHERE i.JustificationItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

        INSERT INTO @stuffIds
        SELECT StuffID
        FROM SLE.JustificationItem i
        WHERE i.JustificationItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

    END;
    ELSE IF (@EntityName = 'Quotation')
    BEGIN

        SELECT @FinancialPeriodID = h.FinancialPeriodID,
               @branchID = h.BranchID
        FROM SLE.Quotation h
            JOIN SLE.QuotationItem i
                ON h.QuotationID = i.QuotationID
        WHERE i.QuotationItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

        INSERT INTO @stuffIds
        SELECT StuffID
        FROM SLE.QuotationItem i
        WHERE i.QuotationItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

    END;
    ELSE IF (@EntityName = 'Remittance')
    BEGIN

        SELECT @FinancialPeriodID = h.FinancialPeriodID,
               @branchID = h.BranchID
        FROM SLE.Remittance h
            JOIN SLE.RemittanceItem i
                ON h.RemittanceID = i.RemittanceID
        WHERE i.RemittanceItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

        INSERT INTO @stuffIds
        SELECT StuffID
        FROM SLE.RemittanceItem i
        WHERE i.RemittanceItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

    END;
    ELSE IF (@EntityName = 'Invoice')
    BEGIN

        SELECT @FinancialPeriodID = h.FinancialPeriodID,
               @branchID = h.BranchID
        FROM SLE.Invoice h
            JOIN SLE.InvoiceItem i
                ON h.InvoiceID = i.InvoiceID
        WHERE i.InvoiceItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

        INSERT INTO @stuffIds
        SELECT StuffID
        FROM SLE.InvoiceItem i
        WHERE i.InvoiceItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

    END;
    ELSE IF @EntityName = 'StuffRequest'
    BEGIN
        SELECT @FinancialPeriodID = h.FinancialPeriodID,
               @branchID = h.BranchID
        FROM REQ.StuffRequest h
            JOIN REQ.StuffRequestItem i
                ON h.StuffRequestID = i.StuffRequestID
        WHERE i.StuffRequestItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

        INSERT INTO @stuffIds
        SELECT StuffID
        FROM REQ.StuffRequestItem i
        WHERE i.StuffRequestItemID IN
              (
                  SELECT a.[value] FROM CFG.R_FnCommaStr2Table(@ID) a
              );

    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM @stuffIds AS s
            JOIN
            (SELECT s2.StuffID FROM STF.Stuff AS s2 WHERE s2.Type = 0) st
                ON st.StuffID = s.StuffId
    )
    BEGIN
        RETURN;
    END;


    IF @controlType = 0
       AND @Confirmed = 2
        RETURN;

    SET @TableName1 = CFG.getTempTableName(1);

    DECLARE @StuffIdsStr NVARCHAR(Max);

    SELECT @StuffIdsStr = STUFF(
    (
        SELECT ',' + CAST(StuffId AS NVARCHAR(200))
        FROM @stuffIds
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,    ''
                               );

 exec  [STC].spGetInventoryInDate
    @StuffId  =@StuffIdsStr ,
    @stockID  = NULL,
	@ToDate = @Date ,
	@FinalTable = @TableName1

    DECLARE @inventoryTempDbName NVARCHAR(20) = CFG.getTempTableName(1),
            @reserveTempDbName NVARCHAR(20) = CFG.getTempTableName(1);

    EXEC (N'SELECT 
					s.BranchID ,
					StuffID ,
					SUM(MainQuantity) AS MainInLine ,
					SUM(isnull(SubQuantity,0)) AS SubInLine
		   INTO ' + @inventoryTempDbName + '
			FROM   ' + @TableName1 + ' t
			JOIN stf.Stock s on t.StockId = s.StockId
			GROUP BY s.BranchID ,StuffID')

	select BranchID,StuffID,sum(Non) MainReserved
	into #reservedStuff
	from cfg.vwReservedStuffs
	group by BranchID,StuffID

    EXEC (N'SELECT 
				i.StuffID,
				i.MainInLine,
				i.SubInLine ,
				r.MainReserved,
				i.MainInLine - ISNULL(r.MainReserved,0) AS MainForSale
		into ##SaleTempDb
		FROM ' + @inventoryTempDbName + ' AS i 
			LEFT JOIN  #reservedStuff AS r ON i.BranchID = r.BranchID AND i.StuffID = r.StuffID')

    SELECT DISTINCT
           a.StuffId,
           CASE @CultureNo
               WHEN 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END Title
    INTO #stuffs
    FROM @stuffIds a
        JOIN STF.[vwStuff] s
            ON a.StuffId = s.StuffID
        LEFT JOIN ##SaleTempDb b
            ON a.StuffId = b.StuffId
    WHERE s.Type = 0
	and
	(b.StuffId IS NULL
          OR b.MainForSale < 0);

    IF NOT EXISTS (SELECT 1 FROM ##SaleTempDb)
       OR EXISTS
    (
        SELECT 1
        FROM #stuffs
    )
    BEGIN
        DECLARE @Message NVARCHAR(MAX),
                @errorState INT,
                @StuffTitle NVARCHAR(MAX);

        SET @errorState = CASE
                              WHEN @controlType = 1 THEN
                                  13
                              ELSE
                                  14
                          END;


        SELECT @StuffTitle = STUFF(
        (
            SELECT '<br/>' + CAST(Title AS NVARCHAR(200))
            FROM #stuffs
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        5   ,
        ''
                                  );

        SET @Message = N'SLE_SpReservedInventory_1^' + @StuffTitle;
        RAISERROR(@Message, 16, @errorState);
    END;

    DROP TABLE ##SaleTempDb;
END;
