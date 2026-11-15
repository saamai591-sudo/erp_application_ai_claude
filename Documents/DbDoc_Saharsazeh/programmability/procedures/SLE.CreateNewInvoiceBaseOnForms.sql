
CREATE    PROC [SLE].CreateNewInvoiceBaseOnForms
(
    @engName NVARCHAR(200),
    @entityId INT
)

--WITH ENCRYPTION
AS
BEGIN
	  DECLARE @PrecisionCount INT,
            @Culture NVARCHAR(5),
            @CultureNo TINYINT,
            @UserID INT,
            @DefaultSaleModelID TINYINT,
            @ErrorMessage NVARCHAR(100),
            @Error INT;
		
	SET @ErrorMessage = 'DocIsRevoked'     
	
	EXEC cfg.spIssueFormBaseOnFormsValidation
	@EntityID = @EntityID,
	@EngName = @EngName,
	@Error = @Error OUTPUT

    SET @UserID = CFG.GetuserID();
    SET @DefaultSaleModelID =
    (
        SELECT TOP 1
               CAST(SettingValue AS TINYINT)
        FROM CFG.UserSetting AS us
        WHERE us.SettingKey = 'DefaultSaleModel'
              AND us.UserID = @UserID
    );

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT DISTINCT
           tdnt.TraceID
    INTO #TraceIds
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE dnt.EngName = 'Invoice';

    IF @engName = 'Quotation'
    BEGIN

        SELECT @PrecisionCount = c.PrecisionCount
        FROM SLE.Quotation AS q
            JOIN CFG.Currency AS c
                ON c.CurrencyID = q.CurrencyID
        WHERE q.QuotationID = @entityId;

        SELECT ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS RowIndex,
               qi.QuotationItemID,
               q.Number AS QuotationNumber,
               qi.SaleModelID,
               CASE @CultureNo
                   WHEN 1 THEN
                       sm.Title
                   WHEN 2 THEN
                       sm.Title2
               END AS SaleModelTitle,
               qi.Fee,
               CASE
                   WHEN qi.Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase,
               qi.Discount,
               qi.Tax,
               qi.Duty,
               qi.StuffID,
               qr.Non AS MainQuantity,
               qr.NonSub AS SubQuantity,
               sd.IranCode,
               sd.Barcode AS BarCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               ROUND(qi.Fee * qr.Non, @PrecisionCount) AS Price,
               qi.Price - qi.Discount + qi.Tax + qi.Duty AS NetPrice
        INTO #temp
        FROM SLE.QuotationItem AS qi
            JOIN SLE.Quotation AS q
                ON q.QuotationID = qi.QuotationID
            JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = qi.SaleModelID
            JOIN SLE.Quotation_Remains AS qr
                ON qr.QuotationItemID = qi.QuotationItemID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE qr.Non > 0
              AND q.QuotationID = @entityId
              AND
              (
                  qr.NonSub IS NULL
                  OR qr.NonSub > 0
              );
        --header
        SELECT q.FinancialPeriodID,
               -1 AS InvoiceID,
               CAST(4 AS TINYINT) BaseDocument,
               q.[Date],
               q.ExpirationDate,
               q.BranchID,
               q.CustomerID,
               q.AddressID,
               q.SaleAreaID SaleAreaId,
               q.CurrencyID,
               q.TotalPrice,
               q.TotalDiscount,
               q.TotalNetPrice,
               q.TotalTax,
               q.TotalDuty,
               p.DlID AS CustomerDlId,
               q.SaleTypeID AS SaleTypeId,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate
        FROM SLE.Quotation AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.QuotationID = @entityId;

        -- items
        SELECT CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               CAST(t.RowIndex AS TINYINT) RowIndex,
               -1 AS InvoiceID,
               t.QuotationItemID,
               t.QuotationNumber,
               t.SaleModelID,
               t.SaleModelTitle,
               t.Fee,
               t.PricedFromBase,
               t.Discount,
               t.Tax,
               t.Duty,
               t.StuffID,
               t.MainQuantity,
               t.SubQuantity,
               t.IranCode,
               t.BarCode,
               t.StuffTitle,
               t.StuffCode,
               t.MainUnit,
               t.Price,
               t.NetPrice
        FROM #temp AS t;

        --traces
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY t.RowIndex) AS INT) AS InvoiceItemTraceID,
               CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.QuotationItemTrace AS qit
            JOIN #temp AS t
                ON t.QuotationItemID = qit.QuotationItemID
            JOIN #TraceIds
                ON #TraceIds.TraceID = qit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = qit.TraceItemID;

    END;

    ELSE IF @engName = 'Outgoing'
    BEGIN

        DECLARE @baseInfo INT;

        DECLARE @outgoinTempBaseInfo TABLE
        (
            OutgoingItemID INT NOT NULL,
            SaleModelID SMALLINT,
            NonPrice DECIMAL(30, 4),
            BaseNon DECIMAL(30, 4),
            NonDiscount DECIMAL(30, 4),
            BasePrice DECIMAL(30, 4),
            BaseDiscount DECIMAL(30, 4),
            BaseMainQuantity DECIMAL(30, 4),
            CurrencyID INT,
            SaleTypeID INT,
            SaleAreaID INT
        );

        SELECT @baseInfo = sdtb.BaseEntity
        FROM STC.Outgoing oi
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
        ON oi.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        WHERE OutgoingID = @entityId;

        -- TemporaryOutgoing: 7,
        -- Reception: 8,
        -- Justification: 3
        IF (@baseInfo = 3)
        BEGIN
            INSERT INTO @outgoinTempBaseInfo
            (
                OutgoingItemID,
                SaleModelID,
                NonPrice,
                BaseNon,
                NonDiscount,
                BasePrice,
                BaseDiscount,
                BaseMainQuantity,
                CurrencyID,
                SaleTypeID,
                SaleAreaID
            )
            SELECT oi.OutgoingItemID,
                   ji.SaleModelID,
                   jni.NonPrice,
                   jni.Non,
                   jni.NonDiscount,
                   jni.Price,
                   jni.Discount,
                   jni.MainQuantity,
                   jni.CurrencyID,
                   j.SaleTypeID,
                   j.SaleAreaID
            FROM STC.OutgoingItem AS oi
                LEFT JOIN SLE.JustificationItem ji
                    ON ji.JustificationItemID = oi.JustificationItemID
                LEFT JOIN SLE.Justification AS j
                    ON j.JustificationID = ji.JustificationID
                LEFT JOIN [SLE].[Justification_Non_Invoice] jni
                    ON jni.JustificationItemID = ji.JustificationItemID;
        END;

        --   Quotation: 4
        IF @baseInfo = 4
        BEGIN

            INSERT INTO @outgoinTempBaseInfo
            (
                OutgoingItemID,
                SaleModelID,
                NonPrice,
                BaseNon,
                NonDiscount,
                BasePrice,
                BaseDiscount,
                BaseMainQuantity,
                CurrencyID,
                SaleTypeID,
                SaleAreaID
            )
            SELECT oi.OutgoingItemID,
                   qi.SaleModelID,
                   qni.NonPrice,
                   qni.Non,
                   qni.NonDiscount,
                   qni.Price,
                   qni.Discount,
                   qni.MainQuantity,
                   qni.CurrencyID,
                   q.SaleTypeID,
                   q.SaleAreaID
            FROM STC.OutgoingItem AS oi
                LEFT JOIN SLE.QuotationItem qi
                    ON qi.QuotationItemID = oi.QuotationItemID
                LEFT JOIN SLE.Quotation AS q
                    ON q.QuotationID = qi.QuotationID
                LEFT JOIN [SLE].[Quotation_Non_Invoice] qni
                    ON qni.QuotationItemID = qi.QuotationItemID;
        END;

        --   Remittance: 5
        IF @baseInfo = 5
        BEGIN

            INSERT INTO @outgoinTempBaseInfo
            (
                OutgoingItemID,
                SaleModelID,
                NonPrice,
                BaseNon,
                NonDiscount,
                BasePrice,
                BaseDiscount,
                BaseMainQuantity,
                CurrencyID,
                SaleTypeID,
                SaleAreaID
            )
            SELECT oi.OutgoingItemID,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jir.SaleModelID
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qr.SaleModelID
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sci2.SaleModelID
                       ELSE
                           NULL
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.NonPrice
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.NonPrice
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.NonPrice
                       ELSE
                           0
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.Non
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.Non
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.Non
                       ELSE
                           NULL
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.NonDiscount
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.NonDiscount
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.NonDiscount
                       ELSE
                           0
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.Price
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.Price
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.Price
                       ELSE
                           0
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.Discount
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.Discount
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.Discount
                       ELSE
                           0
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.MainQuantity
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.MainQuantity
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.MainQuantity
                       ELSE
                           0
                   END,
                   CASE
                       WHEN ri.JustificationItemID IS NOT NULL THEN
                           jni1.CurrencyID
                       WHEN ri.QuotationItemID IS NOT NULL THEN
                           qni2.CurrencyID
                       WHEN sci2.SaleContractItemID IS NOT NULL THEN
                           sndi2.CurrencyID
                       ELSE
                           -1
                   END,
                   r2.SaleTypeID,
				   r2.SaleAreaID
            FROM STC.OutgoingItem AS oi
                LEFT JOIN SLE.RemittanceItem ri
                    ON ri.RemittanceItemID = oi.RemittanceItemID
				LEFT JOIN SLE.Remittance AS r2 ON r2.RemittanceID = ri.RemittanceID
                LEFT JOIN SLE.JustificationItem jir
                    ON jir.JustificationItemID = ri.JustificationItemID
                LEFT JOIN SLE.Justification AS j
                    ON j.JustificationID = jir.JustificationID
                LEFT JOIN [SLE].[Justification_Non_Invoice] jni1
                    ON jni1.JustificationItemID = ri.JustificationItemID
                LEFT JOIN SLE.QuotationItem qr
                    ON qr.QuotationItemID = ri.QuotationItemID
                LEFT JOIN [SLE].[Quotation_Non_Invoice] qni2
                    ON qni2.QuotationItemID = qr.QuotationItemID
                LEFT JOIN SLE.RemittanceItem AS ri2
                    ON oi.RemittanceItemID = ri2.RemittanceItemID
                LEFT JOIN SLE.Remittance AS r
                    ON r.RemittanceID = ri2.RemittanceID
                LEFT JOIN SLE.SaleContractItem AS sci2
                    ON sci2.SaleContractItemID = ri2.SaleContractItemID
                LEFT JOIN [SLE].[SaleContract_Non_Invoice] AS sndi2
                    ON sndi2.SaleContractItemID = sci2.SaleContractItemID
            WHERE ri.InvoiceItemID IS NULL;
        END;
        --   SaleContract: 9
        IF @baseInfo = 9
        BEGIN
            INSERT INTO @outgoinTempBaseInfo
            (
                OutgoingItemID,
                SaleModelID,
                NonPrice,
                BaseNon,
                NonDiscount,
                BasePrice,
                BaseDiscount,
                BaseMainQuantity,
                CurrencyID,
				SaleTypeID,
				SaleAreaID
            )
            SELECT oi.OutgoingItemID,
                   sci.SaleModelID,
                   sndi.NonPrice,
                   sndi.Non,
                   sndi.NonDiscount,
                   sndi.Price,
                   sndi.Discount,
                   sndi.MainQuantity,
                   sndi.CurrencyID,
				   sc.SaleTypeID,
				   sc.SaleAreaID
            FROM STC.OutgoingItem AS oi
                LEFT JOIN SLE.SaleContractItem AS sci
                    ON sci.SaleContractItemID = oi.SaleContractItemID
				LEFT JOIN SLE.SaleContract AS sc ON sc.SaleContractID = sci.SaleContractID
                LEFT JOIN [SLE].[SaleContract_Non_Invoice] AS sndi
                    ON sndi.SaleContractItemID = sci.SaleContractItemID
            WHERE oi.OutgoingID = @entityId;
        END;

        SELECT src.RowIndex,
               src.OutgoingItemID AS OutgoingItemId,
               src.Number AS OutgoingNumber,
               src.SaleModelID,
               CASE @CultureNo
                   WHEN 1 THEN
                       sm.Title
                   WHEN 2 THEN
                       sm.Title2
               END AS SaleModelTitle,
               CASE
                   WHEN src.BaseNon IS NOT NULL
                        AND src.BaseNon = src.MainQuantity THEN
                       ROUND(src.NonPrice / src.MainQuantity, 10)
                   WHEN src.BaseNon IS NOT NULL THEN
                       ROUND(src.NonPrice / src.BaseNon, 10)
                   ELSE
                       0
               END Fee,
               CASE
                   WHEN src.BaseNon IS NOT NULL
                        AND src.BaseNon = src.MainQuantity THEN
                       src.NonDiscount
                   WHEN src.BaseNon IS NOT NULL THEN
                       ROUND((src.NonDiscount / src.BaseNon) * src.MainQuantity, c.PrecisionCount)
                   ELSE
                       0
               END Discount,
               src.StuffID,
               src.MainQuantity,
               src.SubQuantity,
               src.IranCode,
               src.BarCode,
               src.StuffTitle,
               src.StuffCode,
               src.MainUnit,
               CASE
                   WHEN src.BaseNon IS NOT NULL
                        AND src.BaseNon = src.MainQuantity THEN
                       src.NonPrice
                   WHEN src.BaseNon IS NOT NULL THEN
                       ROUND((src.NonPrice / src.BaseNon) * src.MainQuantity, c.PrecisionCount)
                   ELSE
                       0
               END Price,
               src.BasePrice,
               src.BaseDiscount,
               src.BaseMainQuantity,
               src.OutgoingBaseType,
               src.CurrencyID AS BaseCurrency,
               CAST(CASE
                        WHEN sm.SaleModelID IS NULL THEN
                            0
                        ELSE
                            1
                    END AS BIT) DisableSaleModel,
					src.SaleTypeID,
					src.SaleAreaID
        INTO #itemsTemp
        FROM
        (
            SELECT oi.OutgoingItemID,
                   ROW_NUMBER() OVER (ORDER BY oi.RowIndex) RowIndex,
                   CASE
                       WHEN otbi.SaleModelID IS NULL THEN
                           @DefaultSaleModelID
                       ELSE
                           otbi.SaleModelID
                   END SaleModelID,
                   ore.Non MainQuantity,
                   ore.NonSub SubQuantity,
                   o.Number,
                   oi.StuffID,
                   s.Code StuffCode,
                   CASE @CultureNo
                       WHEN 1 THEN
                           s.Title
                       WHEN 2 THEN
                           s.Title2
                   END AS StuffTitle,
                   IIF(otbi.NonPrice IS NULL, 0, otbi.NonPrice) NonPrice,
                   otbi.BaseNon BaseNon,
                   IIF(otbi.NonDiscount IS NULL, 0, otbi.NonDiscount) NonDiscount,
                   IIF(otbi.BasePrice IS NULL, 0, otbi.BasePrice) BasePrice,
                   IIF(otbi.BaseDiscount IS NULL, 0, otbi.BaseDiscount) BaseDiscount,
                   IIF(otbi.BaseMainQuantity IS NULL, 0, otbi.BaseMainQuantity) BaseMainQuantity,
                   IIF(otbi.CurrencyID IS NULL, -1, otbi.CurrencyID) CurrencyID,
                   CASE @CultureNo
                       WHEN 1 THEN
                           mu.Title
                       WHEN 2 THEN
                           mu.Title2
                   END AS MainUnit,
                   sd.Barcode AS BarCode,
                   sd.IranCode,
				   otbi.SaleTypeID,
				   otbi.SaleAreaID,
                   CAST(sdtb.BaseEntity AS INT) AS OutgoingBaseType
            FROM STC.OutgoingItem oi
                JOIN STC.Outgoing o
                    ON o.OutgoingID = oi.OutgoingID
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                    ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                JOIN STF.Stock st
                    ON st.StockID = o.StockID
                JOIN STC.StockDocumentType sdt
                    ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                JOIN SLE.Outgoing_Remains ore
                    ON ore.OutgoingItemID = oi.OutgoingItemID
                JOIN STF.[Stuff] s
                    ON s.StuffID = oi.StuffID
                JOIN STF.StuffDetail AS sd
                    ON sd.StuffID = s.StuffID
                JOIN STF.MeasureUnit AS mu
                    ON mu.MeasureUnitID = s.MainMeasureUnitID
                LEFT JOIN @outgoinTempBaseInfo AS otbi
                    ON otbi.OutgoingItemID = oi.OutgoingItemID
            WHERE oi.OutgoingID = @entityId
                  AND ore.Non > 0
                  AND oi.InvoiceItemID IS NULL
                  AND
                  (
                      sdt.DocumentType = 1
                      OR sdt.DocumentType = 10
                  )
        ) AS src
            LEFT JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = src.SaleModelID
            LEFT JOIN CFG.Currency AS c
                ON c.CurrencyID = src.CurrencyID;
                

        DECLARE @baseCurrency INT,
                @SaleTypeID INT,
                @SaleAreaID INT;

        SELECT TOP 1
               @baseCurrency = it.BaseCurrency
        FROM #itemsTemp AS it;

        SELECT SaleTypeID
        INTO #Trrrr
        FROM #itemsTemp
        GROUP BY SaleTypeID;

        IF @@ROWCOUNT = 1
            SELECT TOP 1
                   @SaleTypeID = it.SaleTypeID
            FROM #itemsTemp AS it;

        SELECT SaleAreaID
        INTO #Trrrr1
        FROM #itemsTemp
        GROUP BY SaleAreaID;
        IF @@ROWCOUNT = 1
        BEGIN
            SELECT TOP 1
                   @SaleAreaID = it.SaleAreaID
            FROM #itemsTemp AS it;
        END;

        IF @baseCurrency IS NULL
            SET @baseCurrency = -1;

        --header
        SELECT o.FinancialPeriodID,
               -1 AS InvoiceID,
               CAST(9 AS TINYINT) BaseDocument,
               s.BranchID,
               o.[Date],
               CASE
                   WHEN
                   (
                       SELECT ods.SettingValue
                       FROM CFG.OriginDestinationSetting AS ods
                           JOIN MDT.DmdEntity AS m
                               ON m.Id = ods.OriginID
                           JOIN MDT.DmdEntity AS m2
                               ON m2.Id = ods.DestinationID
                       WHERE m.Name = 'Outgoing'
                             AND m2.Name = 'Invoice'
                             AND ods.SettingKey = 'Date'
                   ) = 1 THEN
                       o.[Date]
                   ELSE
                      CAST(GETDATE() AS DATE)
               END AS [DefaultDate],
               p.PartyID AS CustomerID,
               p.DlID AS CustomerDlId,
               a.AddressID,
               @baseCurrency AS CurrencyID,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate,
               @SaleTypeID SaleTypeId,
               @SaleAreaID SaleAreaId
        FROM STC.Outgoing AS o
            JOIN CFG.Party AS p
                ON o.DeliverDlID = p.DlID
            LEFT JOIN
            (
                SELECT a.PartyID,
                       a.AddressID
                FROM CFG.Address AS a
                WHERE a.IsMain = 1
            ) a
                ON a.PartyID = p.PartyID
            JOIN STF.Stock AS s
                ON s.StockID = o.StockID
        WHERE o.OutgoingID = @entityId;

        -- items
        SELECT CAST(-1 * it.RowIndex AS INT) AS InvoiceItemID,
               -1 AS InvoiceID,
               CAST(it.RowIndex AS smallint) RowIndex,
               it.OutgoingItemId,
               it.OutgoingNumber,
               it.SaleModelID,
               it.SaleModelTitle,
               it.Fee,
               CASE
                   WHEN it.Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase,
               it.Discount,
               it.StuffID,
               it.MainQuantity,
               it.SubQuantity,
               it.IranCode,
               it.BarCode,
               it.StuffTitle,
               it.StuffCode,
               it.MainUnit,
               it.Price,
               it.BasePrice,
               it.BaseDiscount,
               it.BaseMainQuantity,
               it.BaseCurrency,
               it.DisableSaleModel,
               it.OutgoingBaseType
        FROM #itemsTemp AS it;

        -- Traces
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS InvoiceItemTraceID,
               CAST(-i.RowIndex AS INT) AS InvoiceItemID,
               oit.TraceID,
               oit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN oit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       oit.Value
               END Value,
               oit.TraceItemID
        FROM STC.OutgoingItemTrace AS oit
            JOIN #itemsTemp AS i
                ON oit.OutgoingItemId = i.OutgoingItemId
            JOIN #TraceIds AS ti
                ON ti.TraceID = oit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = oit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = oit.TraceItemID;
    END;
    ELSE IF @engName = 'Remittance'
    BEGIN
        SELECT @PrecisionCount = c.PrecisionCount
        FROM CFG.Currency AS c
        WHERE c.CurrencyID = -1;

        SELECT ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS RowIndex,
               ri.RemittanceItemID,
               r.Number AS RemittanceNumber,
               --qi.Fee ,
               CASE
                   WHEN ri.QuotationItemID IS NOT NULL THEN
                       qi.SaleModelID
                   WHEN ri.JustificationItemID IS NOT NULL THEN
                       ji.SaleModelID
                   ELSE
                       NULL
               END AS SaleModelID,
               CASE
                   WHEN ri.QuotationItemID IS NOT NULL THEN
                       sm1.Title
                   WHEN ri.JustificationItemID IS NOT NULL THEN
                       sm.Title
                   ELSE
                       NULL
               END AS SaleModelTitle,
               CAST(CASE
                        WHEN ri.QuotationItemID IS NOT NULL THEN
                            CASE
                                WHEN rr.Non = qni.Non THEN
                                    qni.NonDiscount
                                ELSE
                                    ROUND((qni.Discount / qni.MainQuantity) * rr.Non, @PrecisionCount)
                            END
                        WHEN ri.JustificationItemID IS NOT NULL THEN
                            CASE
                                WHEN rr.Non = jni.Non THEN
                                    jni.NonDiscount
                                ELSE
                                    ROUND((jni.Discount / jni.MainQuantity) * rr.Non, @PrecisionCount)
                            END
                        ELSE
                            0
                    END AS DECIMAL(30, 4)) Discount,
               CAST(0 AS DECIMAL(30, 4)) AS Tax,
               CAST(0 AS DECIMAL(30, 4)) AS Duty,
               ri.StuffID,
               rr.Non AS MainQuantity,
               rr.NonSub AS SubQuantity,
               sd.IranCode,
               sd.Barcode AS BarCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               CAST(CASE
                        WHEN ri.QuotationItemID IS NOT NULL THEN
                            ROUND(qni.Price/qni.MainQuantity*rr.Non,@PrecisionCount)
                        WHEN ri.JustificationItemID IS NOT NULL THEN
                            ROUND(jni.Price/jni.MainQuantity*rr.Non,@PrecisionCount)
                        ELSE
                            0
                    END AS DECIMAL(30, 4)) AS Price
        INTO #QuotationItems
        FROM SLE.RemittanceItem AS ri
            JOIN SLE.Remittance AS r
                ON r.RemittanceID = ri.RemittanceID
            JOIN SLE.Remittance_Remains rr
                ON rr.RemittanceItemID = ri.RemittanceItemID
            --------------------
            LEFT JOIN SLE.JustificationItem ji
                ON ji.JustificationItemID = ri.JustificationItemID
            LEFT JOIN [SLE].[Justification_Non_Invoice] AS jni
                ON jni.JustificationItemID = ri.JustificationItemID
            LEFT JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = ji.SaleModelID
            --------------------
            LEFT JOIN SLE.QuotationItem qi
                ON qi.QuotationItemID = ri.QuotationItemID
            LEFT JOIN [SLE].[Quotation_Non_Invoice] qni
                ON qni.QuotationItemID = ri.QuotationItemID
            LEFT JOIN SLE.SaleModel AS sm1
                ON sm.SaleModelID = qi.SaleModelID
            -------------------
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ri.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE rr.Non > 0
              AND r.RemittanceID = @entityId
              AND
              (
                  rr.NonSub IS NULL
                  OR rr.NonSub > 0
              );

        --header
        SELECT q.FinancialPeriodID,
               -1 AS InvoiceID,
               q.date AS [Date],
               CAST(5 AS TINYINT) BaseDocument,
               q.BranchID,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.AddressID,
               -1 AS CurrencyID,
               CAST(1 AS DECIMAL(30, 4)) AS CurrencyRate,
               CAST(0 AS DECIMAL(30, 4)) AS TotalPrice,
               CAST(0 AS DECIMAL(30, 4)) AS TotalDiscount,
               CAST(0 AS DECIMAL(30, 4)) AS TotalNetPrice,
               CAST(0 AS DECIMAL(30, 4)) AS TotalTax,
               CAST(0 AS DECIMAL(30, 4)) AS TotalDuty,
               q.SaleTypeID AS SaleTypeId,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate,
               q.DeadLine AS ExpirationDate,
               p.DlID AS CustomerDlId
        FROM SLE.Remittance AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.RemittanceID = @entityId;

        -- items
        SELECT CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               -1 AS InvoiceID,
               CAST(t.RowIndex AS TINYINT) RowIndex,
               t.RemittanceItemID,
               t.RemittanceNumber,
               t.SaleModelID,
               t.SaleModelTitle,
               ROUND(t.Price / t.MainQuantity, 4) AS Fee,
               CASE
                   WHEN Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase,
               t.Discount,
               t.Tax,
               t.Duty,
               t.StuffID,
               t.MainQuantity,
               t.SubQuantity,
               t.IranCode,
               t.BarCode,
               t.StuffTitle,
               t.StuffCode,
               t.MainUnit,
               t.Price,
               CAST(t.Price - t.Discount + t.Tax + t.Duty AS DECIMAL(30, 4)) NetPrice
        FROM #QuotationItems AS t;

        --traces
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY t.RowIndex) AS INT) AS InvoiceItemTraceID,
               CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.RemittanceItemTrace AS qit
            JOIN #QuotationItems AS t
                ON t.RemittanceItemID = qit.RemittanceItemID
            JOIN #TraceIds
                ON #TraceIds.TraceID = qit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'SaleContract'
    BEGIN
        SELECT @PrecisionCount = c.PrecisionCount
        FROM SLE.SaleContract AS q
            JOIN CFG.Currency AS c
                ON c.CurrencyID = q.CurrencyID
        WHERE q.SaleContractID = @entityId;

        SELECT ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS RowIndex,
               qi.SaleContractItemID,
               q.Number AS SaleContractNumber,
               qi.SaleModelID,
               CASE @CultureNo
                   WHEN 1 THEN
                       sm.Title
                   WHEN 2 THEN
                       sm.Title2
               END AS SaleModelTitle,
               qi.Fee,
               qi.Discount,
               qi.Tax,
               qi.Duty,
               qi.StuffID,
               qr.Non AS MainQuantity,
               qr.SubNon AS SubQuantity,
               sd.IranCode,
               sd.Barcode AS BarCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               ROUND(qi.Fee * qr.Non, @PrecisionCount) AS Price,
               qi.Price - qi.Discount + qi.Tax + qi.Duty AS NetPrice
        INTO #SaleContractItems
        FROM SLE.SaleContractItem AS qi
            JOIN SLE.SaleContract AS q
                ON q.SaleContractID = qi.SaleContractID
            JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = qi.SaleModelID
            JOIN SLE.SaleContract_Remains AS qr
                ON qr.SaleContractItemID = qi.SaleContractItemID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE qr.Non > 0
              AND q.SaleContractID = @entityId
              AND
              (
                  qr.SubNon IS NULL
                  OR qr.SubNon > 0
              );
        
        --header
        SELECT q.FinancialPeriodID,
               -1 AS InvoiceID,
               CAST(14 AS TINYINT) BaseDocument,
               q.[Date],
               q.BranchID,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.CurrencyID,
               CAST(1 AS DECIMAL(30, 4)) CurrencyRate,
               q.TotalPrice,
               q.TotalDiscount,
               q.TotalNetPrice,
               q.TotalTax,
               q.TotalDuty,
               q.SaleTypeID AS SaleTypeId,
               CAST(1 AS BIT) IsNotInFlow,
               p.DlID AS CustomerDlId,
               GETDATE() CreationDate
        FROM SLE.SaleContract AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.SaleContractID = @entityId;

        -- items
        SELECT CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               -1 AS InvoiceID,
               CAST(t.RowIndex AS TINYINT) RowIndex,
               t.SaleContractItemID,
               t.SaleContractNumber,
               t.SaleModelID,
               t.SaleModelTitle,
               t.Fee,
               CASE
                   WHEN t.Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase,
               t.Discount,
               t.Tax,
               t.Duty,
               t.StuffID,
               t.MainQuantity,
               t.SubQuantity,
               t.IranCode,
               t.BarCode,
               t.StuffTitle,
               t.StuffCode,
               t.MainUnit,
               t.Price,
               t.NetPrice
        FROM #SaleContractItems AS t;

        --traces
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY t.RowIndex) AS INT) AS InvoiceItemTraceID,
               CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.SaleContractItemTrace AS qit
            JOIN #SaleContractItems AS t
                ON t.SaleContractItemID = qit.SaleContractItemID
            JOIN #TraceIds
                ON #TraceIds.TraceID = qit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'Justification'
    BEGIN
        SELECT @PrecisionCount = c.PrecisionCount
        FROM SLE.Justification AS q
            JOIN CFG.Currency AS c
                ON c.CurrencyID = q.CurrencyID
        WHERE q.JustificationID = @entityId;

        SELECT ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS RowIndex,
               qi.JustificationItemID,
               q.Number AS JustificationNumber,
               qi.SaleModelID,
               CASE @CultureNo
                   WHEN 1 THEN
                       sm.Title
                   WHEN 2 THEN
                       sm.Title2
               END AS SaleModelTitle,
               qi.StuffID,
               qr.Non AS MainQuantity,
               qr.NonSub AS SubQuantity,
               sd.IranCode,
               sd.Barcode AS BarCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               qi.Fee,
               qi.Price,
               qi.Discount
        INTO #JustificationItems
        FROM SLE.JustificationItem AS qi
            JOIN SLE.Justification AS q
                ON q.JustificationID = qi.JustificationID
            JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = qi.SaleModelID
            JOIN SLE.Justification_Remains AS qr
                ON qr.JustificationItemID = qi.JustificationItemID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE qr.Non > 0
              AND q.JustificationID = @entityId
              AND
              (
                  qr.NonSub IS NULL
                  OR qr.NonSub > 0
              );
        --header
        SELECT q.FinancialPeriodID,
               -1 AS InvoiceID,
               CAST(3 AS TINYINT) BaseDocument,
               q.[Date],
               q.BranchID,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.SaleTypeID AS SaleTypeId,
               q.AddressID,
               q.CurrencyID,
               CAST(1 AS DECIMAL(30, 4)) CurrencyRate,
               q.SaleTypeID AS SaleTypeId,
               CAST(1 AS BIT) IsNotInFlow,
               p.DlID AS CustomerDlId,
               GETDATE() CreationDate
        FROM SLE.Justification AS q
            JOIN CFG.Party AS p
                ON p.PartyID = q.CustomerID
        WHERE q.JustificationID = @entityId;

        -- items
        SELECT CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               -1 AS InvoiceID,
               CAST(t.RowIndex AS TINYINT) RowIndex,
               t.JustificationItemID,
               t.JustificationNumber,
               t.SaleModelID,
               t.SaleModelTitle,
               t.Fee,
               CASE
                   WHEN t.Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase,
               t.Discount,
               t.StuffID,
               t.MainQuantity,
               t.SubQuantity,
               t.IranCode,
               t.BarCode,
               t.StuffTitle,
               t.StuffCode,
               t.MainUnit,
               t.Price
        FROM #JustificationItems AS t;

        --traces
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY t.RowIndex) AS INT) AS InvoiceItemTraceID,
               CAST(-1 * t.RowIndex AS INT) AS InvoiceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.JustificationItemTrace AS qit
            JOIN #JustificationItems AS t
                ON t.JustificationItemID = qit.JustificationItemID
            JOIN #TraceIds
                ON #TraceIds.TraceID = qit.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = qit.TraceItemID;
    END;
END;
