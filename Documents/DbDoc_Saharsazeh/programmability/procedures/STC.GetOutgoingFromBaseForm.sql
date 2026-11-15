
CREATE   PROC [STC].[GetOutgoingFromBaseForm]
(
    @entityId INT,
    @engName NVARCHAR(MAX)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @itemType BIT,
            @StockDocumentTypeBaseEntityID INT,
            @Culture NVARCHAR(5),
            @CultureNo TINYINT,
            @ErrorMessage NVARCHAR(100),
            @Error INT;
	SET @ErrorMessage='DocIsRevoked'           

	EXEC cfg.spIssueFormBaseOnFormsValidation
		@EntityID = @EntityID,
		@EngName = @EngName,@Error=@Error OUTPUT
	
	IF @Error=1
	BEGIN
		RAISERROR(@ErrorMessage,16,12)
		RETURN
	END
    	
	SELECT DISTINCT st.StuffID, st.TraceID
	INTO #TraceIds
	FROM STF.StuffTrace st
		JOIN STF.StuffTraceDocumentNum std
			ON std.StuffTraceID = st.StuffTraceID
		JOIN STF.TraceDocumentNumType AS tdnt
			ON tdnt.TraceDocumentNumTypeID = std.TraceDocumentNumTypeID
		JOIN CFG.DocumentNumType AS dnt
			ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
	WHERE dnt.EngName = 'Outgoing';
	
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    DECLARE @IsStuffRequestSurveyable NVARCHAR(100),
            @isConfirmed BIT;

    SELECT @IsStuffRequestSurveyable = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'IsStuffRequestSurveyable';

    IF (
            @IsStuffRequestSurveyable IS NOT NULL
            AND LOWER(@IsStuffRequestSurveyable) = 'true'
        )
    BEGIN
        SET @isConfirmed = 1;
    END;
    ELSE
    BEGIN
        SET @isConfirmed = 0;
    END;

	select *
	into #VWStuff
	from STF.VWStuff

    IF (@engName = 'Quotation')
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
               qi.QuotationItemID,
               qi.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end AS  MainUnit,
               s.IsStuffSerializable,
               q.Number QuotationNumber,
               qno.Non AS MainQuantity,
               qno.NonSub AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType
        INTO #items
        FROM SLE.QuotationItem AS qi
            JOIN SLE.Quotation AS q
                ON q.QuotationID = qi.QuotationID
            JOIN SLE.Quotation_Remains AS qno
                ON qno.QuotationItemID = qi.QuotationItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
        WHERE qi.QuotationID = @entityId
              AND qno.Non > 0
              AND
              (
                  qno.NonSub IS NULL
                  OR qno.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT @itemType = st.[Type]
        FROM SLE.Quotation AS q
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = q.SaleTypeID
        WHERE q.QuotationID = @entityId;

        IF (@itemType = 1)
        BEGIN

             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 1;
        END;
        ELSE
        BEGIN

             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 10;
        END;

        --header
        SELECT -1 AS OutgoingID,
               CAST(1 AS TINYINT) AS Type,
               q.Date,
               q.Date Date_Original,
               GETDATE() CreationDate,
               p.DlID DeliverDlID,
               NULL DeliverStockID,
               q.FinancialPeriodID,
               @StockDocumentTypeBaseEntityID AS StockDocumentTypeBaseEntityID,
               q.ExpirationDate AS DeadLine,
               q.BranchID
        FROM SLE.Quotation AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.QuotationID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
			   -1 AS OutgoingID,
               i.RowIndex,
               i.QuotationItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.QuotationNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               i.IsQuantityIncreasable,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.StuffDetailType
        FROM #items AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
               CAST(-i.RowIndex AS INT) AS OutgoingItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.Version,
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.QuotationItemTrace AS qit
            JOIN #items AS i
                ON i.QuotationItemID = qit.QuotationItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'Invoice'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS SMALLINT) RowIndex,
               i.InvoiceItemID,
               i.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end  MainUnit,
               s.IsStuffSerializable,
               h.Number InvoiceNumber,
               ino.Non AS MainQuantity,
               ino.NonSub AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType,
               rr.StockID
        INTO #invoiceItems
        FROM SLE.InvoiceItem AS i
            JOIN SLE.Invoice AS h
                ON h.InvoiceID = i.InvoiceID
            LEFT JOIN
            (
                SELECT ri.RemittanceItemID,
                       r.StockID
                FROM SLE.Remittance AS r
                    JOIN SLE.RemittanceItem AS ri
                        ON ri.RemittanceID = r.RemittanceID
            ) rr
                ON rr.RemittanceItemID = i.RemittanceItemID
            JOIN SLE.Invoice_Remains AS ino
                ON ino.InvoiceItemID = i.InvoiceItemID
            JOIN #VWStuff AS s
                ON s.StuffID = i.StuffID
        WHERE i.InvoiceID = @entityId
              AND ino.Non > 0
              AND
              (
                  ino.NonSub IS NULL
                  OR ino.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT @itemType = st.[Type]
        FROM SLE.Invoice AS q
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = q.SaleTypeID
        WHERE q.InvoiceID = @entityId;

        IF (@itemType = 1)
        BEGIN
            SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            FROM STC.StockDocumentType AS sdt
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.[Type] = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 1;
        END;
        ELSE
        BEGIN
            SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            FROM STC.StockDocumentType AS sdt
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.[Type] = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 10;
        END;

        --header
        SELECT -1 AS OutgoingID,
               CAST(1 AS TINYINT) AS Type,
               q.Date,
               q.Date Date_Original,
               GETDATE() CreationDate,
               p.DlID DeliverDlID,
               NULL DeliverStockID,
               q.FinancialPeriodID,
               q.BranchID,
               @StockDocumentTypeBaseEntityID AS StockDocumentTypeBaseEntityID
        FROM SLE.Invoice AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.InvoiceID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
			   -1 AS OutgoingID,
               i.RowIndex,
               i.InvoiceItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.InvoiceNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               i.IsQuantityIncreasable,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.StuffDetailType,
               i.StockID
        FROM #invoiceItems AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
               CAST(-i.RowIndex AS INT) AS OutgoingItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.Version,
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.InvoiceItemTrace AS qit
            JOIN #invoiceItems AS i
                ON i.InvoiceItemID = qit.InvoiceItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF (@engName = 'Remittance')
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
               qi.RemittanceItemID,
               qi.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end MainUnit,
               s.IsStuffSerializable,
               q.Number RemittanceNumber,
               qno.Non AS MainQuantity,
               qno.NonSub AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType
        INTO #RemittanceItems
        FROM SLE.RemittanceItem AS qi
            JOIN SLE.Remittance AS q
                ON q.RemittanceID = qi.RemittanceID
            JOIN SLE.Remittance_Remains AS qno
                ON qno.RemittanceItemID = qi.RemittanceItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
        WHERE qi.RemittanceID = @entityId
              AND qno.Non > 0
              AND
              (
                  qno.NonSub IS NULL
                  OR qno.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT @itemType = st.[Type]
        FROM SLE.Remittance AS q
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = q.SaleTypeID
        WHERE q.RemittanceID = @entityId;

        IF (@itemType = 1)
        BEGIN

             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 1;
        END;
        ELSE
        BEGIN

             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 10;
        END;

        --header
        SELECT -1 AS OutgoingID,
               CAST(1 AS TINYINT) AS [Type],
               q.StockID,
               q.[Date],
               q.[Date] Date_Original,
               GETDATE() CreationDate,
               p.DlID DeliverDlID,
               NULL DeliverStockID,
               q.FinancialPeriodID,
               @StockDocumentTypeBaseEntityID AS StockDocumentTypeBaseEntityID,
               q.DeadLine
        FROM SLE.Remittance AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.RemittanceID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
			   -1 AS OutgoingID,
               i.RowIndex,
               i.RemittanceItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.RemittanceNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               i.IsQuantityIncreasable,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.StuffDetailType
        FROM #RemittanceItems AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
               CAST(-i.RowIndex AS INT) AS OutgoingItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.Version,
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.RemittanceItemTrace AS qit
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID
            JOIN #RemittanceItems AS i
                ON i.RemittanceItemID = qit.RemittanceItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID;
    END;
    ELSE IF @engName = 'SaleContract'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
               qi.SaleContractItemID,
               qi.StuffID,
               s.Code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end MainUnit,
               s.IsStuffSerializable,
               q.Number SaleContractNumber,
               qno.Non AS MainQuantity,
               qno.SubNon AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType
        INTO #SaleContractItems
        FROM SLE.SaleContractItem AS qi
            JOIN SLE.SaleContract AS q
                ON q.SaleContractID = qi.SaleContractID
            JOIN SLE.SaleContract_Remains AS qno
                ON qno.SaleContractItemID = qi.SaleContractItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
        WHERE qi.SaleContractID = @entityId
              AND qno.Non > 0
              AND
              (
                  qno.SubNon IS NULL
                  OR qno.SubNon > 0
              )
              AND s.[Type] = 0;

        SELECT @itemType = st.[Type]
        FROM SLE.SaleContract AS q
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = q.SaleTypeID
        WHERE q.SaleContractID = @entityId;

        IF (@itemType = 1)
        BEGIN
             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 1;
        END;
        ELSE
        BEGIN
             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 10;
        END;

        --header
        SELECT -1 AS OutgoingID,
               CAST(1 AS TINYINT) AS [Type],
               q.[Date],
               q.[Date] Date_Original,
               GETDATE() CreationDate,
               p.DlID DeliverDlID,
               NULL DeliverStockID,
               q.FinancialPeriodID,
               q.BranchID,
               @StockDocumentTypeBaseEntityID AS StockDocumentTypeBaseEntityID
        FROM SLE.SaleContract AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.SaleContractID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
			   -1 AS OutgoingID,
               i.RowIndex,
               i.SaleContractItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.SaleContractNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               i.IsQuantityIncreasable,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.StuffDetailType
        FROM #SaleContractItems AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
               CAST(-i.RowIndex AS INT) AS OutgoingItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.Version,
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.SaleContractItemTrace AS qit
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID
            JOIN #SaleContractItems AS i
                ON i.SaleContractItemID = qit.SaleContractItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID;
    END;
    ELSE IF (@engName = 'Justification')
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
               qi.JustificationItemID,
               qi.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end MainUnit,
               s.IsStuffSerializable,
               q.Number JustificationNumber,
               qno.Non AS MainQuantity,
               qno.NonSub AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType
        INTO #JustificationItems
        FROM SLE.JustificationItem AS qi
            JOIN SLE.Justification AS q
                ON q.JustificationID = qi.JustificationID
            JOIN SLE.Justification_Remains AS qno
                ON qno.JustificationItemID = qi.JustificationItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
        WHERE qi.JustificationID = @entityId
              AND qno.Non > 0
              AND
              (
                  qno.NonSub IS NULL
                  OR qno.NonSub > 0
              )
              AND s.[Type] = 0;

        SELECT @itemType = st.[Type]
        FROM SLE.Justification AS q
            JOIN SLE.SaleType AS st
                ON st.SaleTypeID = q.SaleTypeID
        WHERE q.JustificationID = @entityId;

        IF (@itemType = 1)
        BEGIN
             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 1;
        END;
        ELSE
        BEGIN
             SELECT @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
             FROM STC.StockDocumentType AS sdt
             JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            WHERE sdt.Type = 2
                  AND sdt.DocumentType = 1
                  AND sdt.Code = 10;
        END;

        --header
        SELECT -1 AS OutgoingID,
               CAST(1 AS TINYINT) AS [Type],
               q.Date,
               q.Date Date_Original,
               GETDATE() CreationDate,
               q.BranchID,
               p.DlID DeliverDlID,
               NULL DeliverStockID,
               q.FinancialPeriodID,
               @StockDocumentTypeBaseEntityID AS StockDocumentTypeBaseEntityID
        FROM SLE.Justification AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.JustificationID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
			   -1 AS OutgoingID,
               i.RowIndex,
               i.JustificationItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.JustificationNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               i.IsQuantityIncreasable,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity,
               i.StuffDetailType
        FROM #JustificationItems AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
               CAST(-i.RowIndex AS INT) AS OutgoingItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.[Version],
               qit.Creator,
               qit.CreationDate,
               qit.LastEditor,
               qit.LastEditionDate,
               qit.TraceItemID
        FROM SLE.JustificationItemTrace AS qit
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID
            JOIN #JustificationItems AS i
                ON i.JustificationItemID = qit.JustificationItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID;
    END;
    ELSE IF @engName = 'StuffRequest'
    BEGIN
		declare @RequestType TinyInt

		select @RequestType = [Type]
        FROM REQ.StuffRequest AS q
        WHERE q.StuffRequestID = @entityId;

		if @RequestType = 1
		begin

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.StuffRequestItemIndex) AS SMALLINT) RowIndex,
               qi.StuffRequestItemID,
               qi.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end MainUnit,
               s.IsStuffSerializable,
               q.StuffRequestNumber,
               qno.NonOutgoing AS MainQuantity,
               qno.NonSubOutgoing AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType,
			   cc.DlID CostCenterDlID,
			   s.FixedAssetConversion,
			   p.DlID AS ProjectDlID
			   
        INTO #StuffRequestItems
        FROM REQ.StuffRequestItem AS qi
            JOIN REQ.StuffRequest AS q
                ON q.StuffRequestID = qi.StuffRequestID
            JOIN REQ.StuffRequest_Remains AS qno
                ON qno.StuffRequestItemID = qi.StuffRequestItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
			left join cfg.CostCenter cc 
				on cc.CostCenterID =  qi.CostCenterID
			LEFT JOIN PMO.Project p 
				ON p.ProjectID = qi.ProjectID
        WHERE q.StuffRequestID = @entityId
              AND qno.NonOutgoing > 0
              AND
              (
                  qno.NonSub IS NULL
                  OR qno.NonSub > 0
              )
              AND q.StuffRequestState <> 4
              AND
              (
                  @isConfirmed = 0
                  OR q.StuffRequestState = 2
              )
              AND s.[Type] = 0;
			  
			  declare @totalItemCount int ,
			  @DeliverDlID bigint
			  set @totalItemCount = (select count(1) from #StuffRequestItems)

			  SELECT ROW_NUMBER() OVER ( PARTITION BY a.ProjectDlID ORDER BY a.ProjectDlID) RN, a.ProjectDlID 
			  into #ProjectDlIDs
			  FROM #StuffRequestItems a
			  where  a.ProjectDlID  is not null
			  
			  SELECT ROW_NUMBER() OVER ( PARTITION BY a.CostCenterDlID ORDER BY a.CostCenterDlID) RN, a.CostCenterDlID 
			  into #CostCenterDlIDs
			  FROM #StuffRequestItems a
			  where a.CostCenterDlID  is not null

			if @totalItemCount = (select max(rn) from #ProjectDlIDs)
			BEGIN
				set  @DeliverDlID = (select top(1) ProjectDlID from #ProjectDlIDs)
			END
			else  if @totalItemCount = (select max(rn) from #CostCenterDlIDs)
			BEGIN
				set  @DeliverDlID = (select top(1) CostCenterDlID from #CostCenterDlIDs)
			END
			--header
			SELECT -1 AS OutgoingID,
				   CASE
					   WHEN
					   (
						   SELECT ods.SettingValue
						   FROM CFG.OriginDestinationSetting AS ods
							   JOIN MDT.DmdEntity AS m
								   ON m.Id = ods.OriginID
							   JOIN MDT.DmdEntity AS m2
								   ON m2.Id = ods.DestinationID
						   WHERE m.Name = 'StuffRequest'
								 AND m2.Name = 'Outgoing'
								 AND ods.SettingKey = 'Date'
					   ) = 1 THEN
						  q.StuffRequestDate
					   ELSE
						  CAST(GETDATE() AS DATE)
				   END  AS [Date],
				   q.[StuffRequestDate] Date_Original,
				   GETDATE() CreationDate,
				   q.FinancialPeriodID,				   
				   q.BranchID,
				   @deliverDlID AS DeliverDlID
			FROM REQ.StuffRequest AS q
			WHERE q.StuffRequestID = @entityId;

			-- Items
			SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
				   -1 AS OutgoingID,
				   i.RowIndex,
				   i.StuffRequestItemID,
				   i.StuffID,
				   i.StuffCode,
				   i.StuffTitle,
				   i.BarCode,
				   i.IranCode,
				   i.MainUnit,
                   i.IsStuffSerializable,
				   i.StuffRequestNumber,
				   i.MainQuantity,
				   i.SubQuantity,
				   i.MainQuantity OrgMainQuantity,
                   i.IsQuantityIncreasable,
				   GETDATE() CreationDate,
				   i.SubQuantity OrgSubQuantity,
				   i.StuffDetailType,
				   i.CostCenterDlID,
				   FixedAssetConversion
			FROM #StuffRequestItems AS i;

			-- traces
			SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
				   CAST(-i.RowIndex AS INT) AS OutgoingItemID,
				   qit.TraceID,
				   qit.DlID,
				   d.Code AS DlCode,
				   CASE
					   WHEN qit.TraceItemID IS NOT NULL THEN
						   CASE
							   WHEN @CultureNo = 2 THEN
								   ti2.Item2
							   ELSE
								   ti2.Item
						   END
					   ELSE
						   qit.Value
				   END Value,
				   qit.Version,
				   qit.Creator,
				   qit.CreationDate,
				   qit.LastEditor,
				   qit.LastEditionDate,
				   qit.TraceItemID
			FROM REQ.StuffRequestItemTrace AS qit
				LEFT JOIN STF.TraceItem AS ti2
					ON ti2.TraceItemID = qit.TraceItemID
				JOIN #StuffRequestItems AS i
					ON qit.StuffRequestItemID = i.StuffRequestItemID
				JOIN #TraceIds AS ti
					ON ti.TraceID = qit.TraceID  AND i.StuffID = ti.StuffID
				LEFT JOIN ACC.DL AS d
					ON d.DLID = qit.DlID;
		 END;
    ELSE IF  @RequestType = 2
    BEGIN

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.StuffRequestItemIndex) AS SMALLINT) RowIndex,
               qi.StuffRequestItemID,
               qi.StuffID,
               s.code AS StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end  AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end  MainUnit,
               s.IsStuffSerializable,
               q.StuffRequestNumber,
               qno.NonOutgoing AS MainQuantity,
               qno.NonSubOutgoing AS SubQuantity,
               CAST(0 AS BIT) AS IsQuantityIncreasable,
               S.StuffDetailType,
			   cc.DlID CostCenterDlID,
			   s.FixedAssetConversion
        INTO #TransferRequestItems
        FROM REQ.StuffRequestItem AS qi
            JOIN REQ.StuffRequest AS q
                ON q.StuffRequestID = qi.StuffRequestID
            JOIN REQ.StuffRequest_Remains AS qno
                ON qno.StuffRequestItemID = qi.StuffRequestItemID
            JOIN #VWStuff AS s
                ON s.StuffID = qi.StuffID
			left join cfg.CostCenter cc 
				on cc.CostCenterID = qi.CostCenterID
        WHERE q.StuffRequestID = @entityId
              AND qno.NonOutgoing > 0
              AND
              (
                  qno.NonSub IS NULL
                  OR qno.NonSub > 0
              )
              AND q.StuffRequestState <> 4
              AND
              (
                  @isConfirmed = 0
                  OR q.StuffRequestState = 2
              )
              AND s.[Type] = 0;

			select Top 1 @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            FROM STC.StockDocumentType AS sdt
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
			where Type = 2 and DocumentType = 4 and BaseEntity = 10

			--header
			SELECT -1 AS OutgoingID,
				   CASE
					   WHEN
					   (
						   SELECT ods.SettingValue
						   FROM CFG.OriginDestinationSetting AS ods
							   JOIN MDT.DmdEntity AS m
								   ON m.Id = ods.OriginID
							   JOIN MDT.DmdEntity AS m2
								   ON m2.Id = ods.DestinationID
						   WHERE m.Name = 'StuffRequest'
								 AND m2.Name = 'Outgoing'
								 AND ods.SettingKey = 'Date'
					   ) = 1 THEN
						  q.StuffRequestDate
					   ELSE
						  CAST(GETDATE() AS DATE)
				   END  AS [Date],
				   q.[StuffRequestDate] Date_Original,
				   GETDATE() CreationDate,
				   q.FinancialPeriodID,
				   s1.BranchID,
				   q.ToStockID StockID,
				   q.FromStockID DeliverStockID,
				   @StockDocumentTypeBaseEntityID StockDocumentTypeBaseEntityID
			FROM REQ.StuffRequest AS q
			join stf.Stock s1 on s1.StockID = q.FromStockID
			join stf.Stock s2 on s2.StockID = q.ToStockID
			WHERE q.StuffRequestID = @entityId;

			-- Items
			SELECT CAST(-i.RowIndex AS INT) AS OutgoingItemID,
				   -1 AS OutgoingID,
				   i.RowIndex,
				   i.StuffRequestItemID,
				   i.StuffID,
				   i.StuffCode,
				   i.StuffTitle,
				   i.BarCode,
				   i.IranCode,
				   i.MainUnit,
                   i.IsStuffSerializable,
				   i.StuffRequestNumber,
				   i.MainQuantity,
				   i.SubQuantity,
				   i.MainQuantity OrgMainQuantity,
                   i.IsQuantityIncreasable,
				   GETDATE() CreationDate,
				   i.SubQuantity OrgSubQuantity,
				   i.StuffDetailType,
				   CostCenterDlID,
				   FixedAssetConversion
			FROM #TransferRequestItems AS i;
		
			-- traces
			SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS OutgoingItemTraceID,
				   CAST(-i.RowIndex AS INT) AS OutgoingItemID,
				   qit.TraceID,
				   qit.DlID,
				   d.Code AS DlCode,
				   CASE
					   WHEN qit.TraceItemID IS NOT NULL THEN
						   CASE
							   WHEN @CultureNo = 2 THEN
								   ti2.Item2
							   ELSE
								   ti2.Item
						   END
					   ELSE
						   qit.Value
				   END Value,
				   qit.Version,
				   qit.Creator,
				   qit.CreationDate,
				   qit.LastEditor,
				   qit.LastEditionDate,
				   qit.TraceItemID
			FROM REQ.StuffRequestItemTrace AS qit
				LEFT JOIN STF.TraceItem AS ti2
					ON ti2.TraceItemID = qit.TraceItemID
				JOIN #TransferRequestItems AS i
					ON qit.StuffRequestItemID = i.StuffRequestItemID
				JOIN #TraceIds AS ti
					ON ti.TraceID = qit.TraceID AND i.StuffID = ti.StuffID
				LEFT JOIN ACC.DL AS d
					ON d.DLID = qit.DlID;
		END;
	end
END;

