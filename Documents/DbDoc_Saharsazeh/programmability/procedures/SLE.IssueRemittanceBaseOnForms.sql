
------------------------------------- START #7754
CREATE   PROC [SLE].IssueRemittanceBaseOnForms
(
    @entityId INT,
    @engName NVARCHAR(MAX)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @cultureNo INT;

	SELECT @cultureNo = ci.CultureNo FROM CFG.CultureInfo AS ci
	WHERE ci.Culture = CFG.GetuserCulture()

    SELECT DISTINCT
           tdnt.TraceID
    INTO #TraceIds
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE dnt.EngName = 'Remittance';

    IF @engName = 'Quotation'
    BEGIN
		SELECT qnr.*
		INTO #Quotation_Non_Remittance
		FROM SLE.Quotation_Non_Remittance AS qnr
		WHERE qnr.QuotationID = @entityId

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS TINYINT) RowIndex,
               qi.QuotationItemID,
               q.Number QuotationNumber,
               qi.StuffID,
               s.Code StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end  AS StuffTitle,
               sd.Barcode BarCode,
               sd.IranCode,
               qnr.Non MainQuantity,
               qnr.SubNon SubQuantity,
               mu.Title MainUnit,
               SAG.StuffDetailType,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate
        INTO #items
        FROM SLE.QuotationItem AS qi
            JOIN SLE.Quotation AS q
                ON q.QuotationID = qi.QuotationID
            JOIN STF.[VWStuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            LEFT JOIN #Quotation_Non_Remittance AS qnr
                ON qnr.QuotationItemID = qi.QuotationItemID
        WHERE qnr.Non > 0
              AND
              (
                  qnr.SubNon IS NULL
                  OR qnr.SubNon > 0
              )
              AND qi.QuotationID = @entityId;

        -------------------  header  ---------------------
        SELECT q.FinancialPeriodID,
				-1 AS RemittanceID,
               q.BranchID,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.AddressID,
               q.Date,
               q.SaleTypeID AS SaleTypeId,
               CAST(4 AS TINYINT) BaseDocument,
               GETDATE() CreationDate,
			   q.ExpirationDate AS DeadLine
        FROM SLE.Quotation AS q
        WHERE q.QuotationID = @entityId;

        --------------  items  ---------------
        SELECT CAST(-i.RowIndex AS INT) RemittanceItemID,
				-1 AS RemittanceID,
               i.RowIndex,
               i.QuotationItemID,
               i.QuotationNumber,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainQuantity,
               i.SubQuantity,
               i.MainUnit,
               IsNotInFlow,
               i.StuffDetailType
        FROM #items AS i;

        --------- traces ----------------------
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) RemittanceItemTraceID,
               CAST(-i.RowIndex AS INT) RemittanceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @cultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.QuotationItemTrace AS qit
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID
            JOIN #items AS i
                ON i.QuotationItemID = qit.QuotationItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'Invoice'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS TINYINT) RowIndex,
               qi.InvoiceItemID,
               q.Number InvoiceNumber,
               qi.StuffID,
               s.Code StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end  AS StuffTitle,
               sd.Barcode BarCode,
               sd.IranCode,
               qnr.Non MainQuantity,
               qnr.NonSub SubQuantity,
               mu.Title MainUnit,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate,
               SAG.StuffDetailType
        INTO #invoiceItems
        FROM SLE.InvoiceItem AS qi
            JOIN SLE.Invoice AS q
                ON q.InvoiceID = qi.InvoiceID
            JOIN STF.[vwStuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            LEFT JOIN SLE.Invoice_Remains AS qnr
                ON qnr.InvoiceItemID = qi.InvoiceItemID
        WHERE qnr.Non > 0
              AND
              (
                  qnr.NonSub IS NULL
                  OR qnr.NonSub > 0
              )
              AND qi.InvoiceID = @entityId;

        -------------------- header --------------------------S
        SELECT q.FinancialPeriodID,
				-1 AS RemittanceID,
               q.BranchID,
               q.Date,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.AddressID,
               q.SaleTypeID AS SaleTypeId,
               CAST(6 AS TINYINT) BaseDocument,
               GETDATE() CreationDate
        FROM SLE.Invoice AS q
        WHERE q.InvoiceID = @entityId;

        --------------------- items ----------------------------
        SELECT CAST(-i.RowIndex AS INT) RemittanceItemID,
				-1 AS RemittanceID,
               i.RowIndex,
               i.InvoiceItemID,
               i.InvoiceNumber,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainQuantity,
               i.SubQuantity,
               i.MainUnit,
               i.IsNotInFlow,
               i.StuffDetailType
        FROM #invoiceItems AS i;

        ----------------------- traces ------------------------
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) RemittanceItemTraceID,
               CAST(-i.RowIndex AS INT) RemittanceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @cultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.InvoiceItemTrace AS qit
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID
            JOIN #invoiceItems AS i
                ON i.InvoiceItemID = qit.InvoiceItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'SaleContract'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS TINYINT) RowIndex,
               qi.SaleContractItemID,
               q.Number SaleContractNumber,
               qi.StuffID,
               s.Code StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end  AS StuffTitle,
               sd.Barcode BarCode,
               sd.IranCode,
               qnr.Non MainQuantity,
               qnr.SubNon SubQuantity,
               mu.Title MainUnit,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate,
               SAG.StuffDetailType
        INTO #SaleContractItems
        FROM SLE.SaleContractItem AS qi
            JOIN SLE.SaleContract AS q
                ON q.SaleContractID = qi.SaleContractID
            JOIN STF.[VWStuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            LEFT JOIN SLE.SaleContract_Non_Remittance AS qnr
                ON qnr.SaleContractItemID = qi.SaleContractItemID
        WHERE qnr.Non > 0
              AND
              (
                  qnr.SubNon IS NULL
                  OR qnr.SubNon > 0
              )
              AND qi.SaleContractID = @entityId;

        -------------------- header --------------------------
        SELECT q.FinancialPeriodID,
				-1 AS RemittanceID,
               q.BranchID,
               q.Date,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.SaleTypeID AS SaleTypeId,
               CAST(14 AS TINYINT) BaseDocument,
               GETDATE() CreationDate
        FROM SLE.SaleContract AS q
        WHERE q.SaleContractID = @entityId;

        --------------------- items ----------------------------
        SELECT CAST(-i.RowIndex AS INT) RemittanceItemID,
				-1 AS RemittanceID,
               i.RowIndex,
               i.SaleContractItemID,
               i.SaleContractNumber,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainQuantity,
               i.SubQuantity,
               i.MainUnit,
               i.IsNotInFlow,
               i.StuffDetailType
        FROM #SaleContractItems AS i;

        ----------------------- traces ------------------------
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) RemittanceItemTraceID,
               CAST(-i.RowIndex AS INT) RemittanceItemID,
               qit.TraceID,
               d.Code AS DlCode,
               qit.DlID,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @cultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.SaleContractItemTrace AS qit
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID
            JOIN #SaleContractItems AS i
                ON i.SaleContractItemID = qit.SaleContractItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
    ELSE IF @engName = 'Justification'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS TINYINT) RowIndex,
               qi.JustificationItemID,
               q.Number JustificationNumber,
               qi.StuffID,
               s.Code StuffCode,
               case when @CultureNo = 1 then s.Title else s.Title2 end  AS StuffTitle,
               sd.Barcode BarCode,
               sd.IranCode,
               qnr.Non MainQuantity,
               qnr.NonSub SubQuantity,
               mu.Title MainUnit,
               CAST(1 AS BIT) IsNotInFlow,
               GETDATE() CreationDate,
               SAG.StuffDetailType
        INTO #JustificationItems
        FROM SLE.JustificationItem AS qi
            JOIN SLE.Justification AS q
                ON q.JustificationID = qi.JustificationID
            JOIN STF.[VWStuff] AS s
                ON s.StuffID = qi.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            LEFT JOIN SLE.Justification_Remains AS qnr
                ON qnr.JustificationItemID = qi.JustificationItemID
        WHERE qnr.Non > 0
              AND
              (
                  qnr.NonSub IS NULL
                  OR qnr.NonSub > 0
              )
              AND qi.JustificationID = @entityId;

        -------------------- header --------------------------
        SELECT q.FinancialPeriodID,
				-1 AS RemittanceID,
               q.BranchID,
               q.Date,
               q.CustomerID,
               q.SaleAreaID AS SaleAreaId,
               q.AddressID,
               q.SaleTypeID AS SaleTypeId,
               CAST(3 AS TINYINT) BaseDocument,
               GETDATE() CreationDate
        FROM SLE.Justification AS q
        WHERE q.JustificationID = @entityId;

        --------------------- items ----------------------------
        SELECT CAST(-i.RowIndex AS INT) RemittanceItemID,
				-1 AS RemittanceID,
               i.RowIndex,
               i.JustificationItemID,
               i.JustificationNumber,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainQuantity,
               i.SubQuantity,
               i.MainUnit,
               i.IsNotInFlow,
               i.StuffDetailType
        FROM #JustificationItems AS i;

        ----------------------- traces ------------------------
        SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) RemittanceItemTraceID,
               CAST(-i.RowIndex AS INT) RemittanceItemID,
               qit.TraceID,
               qit.DlID,
               d.Code AS DlCode,
               CASE
                   WHEN qit.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @cultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       qit.Value
               END Value,
               qit.TraceItemID
        FROM SLE.JustificationItemTrace AS qit
            JOIN #TraceIds AS ti
                ON ti.TraceID = qit.TraceID
            JOIN #JustificationItems AS i
                ON i.JustificationItemID = qit.JustificationItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = qit.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = qit.TraceItemID;
    END;
END;
