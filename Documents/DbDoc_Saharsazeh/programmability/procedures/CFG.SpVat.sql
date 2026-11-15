
------------------------------------- START #8286
CREATE    PROC [CFG].SpVat
    @FromDate DATE,
    @EndDate DATE,
    @FinancialPeriod INT,
    @CompanyID INT=NULL
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            ELSE
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    DECLARE @BaseCurtrencyPrecisionCount INT;
    SELECT @BaseCurtrencyPrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

	   
    CREATE TABLE #T
    (
        BranchId INT NULL,
        DocType TINYINT NOT NULL,
        [Type] INT NULL,
        [NatureType] INT NULL,
        Number VARCHAR(50) NOT NULL,
        DATE VARCHAR(50) NOT NULL,
        ItemNumber INT NULL,
        Amount DECIMAL(30, 4) NOT NULL,
        InclusiveVatStuffs DECIMAL(30, 4) NOT NULL, --8-	مبلغ کالا و خدمات مشمول
        ExemptOfVatStuffs DECIMAL(30, 4) NOT NULL,  --10-	مبلغ کالا و خدمات معاف
        Tax DECIMAL(30, 4) NOT NULL,
        Duty DECIMAL(30, 4) NOT NULL,
        DocId INT NULL,
        DocItemId INT NULL,
        CurrencyId INT NULL,
        CurrencyRate DECIMAL(18, 4) NULL,
        NewType INT NULL,
		VatCurrencyID int
    );

    INSERT INTO #T
    (
        BranchId,
        DocType,
        Type,
        NatureType,
        Number,
        DATE,
        ItemNumber,
        Amount,
        InclusiveVatStuffs,
        ExemptOfVatStuffs,
        Tax,
        Duty,
        DocId,
        DocItemId,
        CurrencyId,
        CurrencyRate,
        NewType,
		VatCurrencyID
    )
    SELECT i.BranchID,
           1,
           st.SaleTypeID,
           CASE st.Type
               WHEN 1 THEN
                   1
               ELSE
                   2
           END,
           i.Number,
           CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DATE,
           ii.RowIndex,
           (ii.Price - ii.Discount) Amount,
           0,
           0,
           ii.Tax Tax,
           ii.Duty Duty,
           i.InvoiceID,
           ii.InvoiceItemID,
           i.CurrencyID,
           i.CurrencyRate,
           0,
		   i.CurrencyID
    FROM SLE.Invoice i
        INNER JOIN SLE.InvoiceItem AS ii
            ON ii.InvoiceID = i.InvoiceID
        JOIN SLE.SaleType AS st
            ON st.SaleTypeID = i.SaleTypeID
        JOIN CFG.Branch AS b ON b.BranchID=i.BranchID
    WHERE i.Date
          BETWEEN @FromDate AND @EndDate
          AND i.SaleInvoiceStatus <> 5
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --- RETURNED SALE ---

    SELECT i.BranchID,
           2,
           st.SaleTypeID,
           CASE st.Type
               WHEN 1 THEN
                   1
               ELSE
                   2
           END,
           i.Number,
           CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DATE,
           ii.RowIndex,
           (ii.Price - ii.Discount) * -1 Amount,
           0,
           0,
           ii.Tax * -1 Tax,
           ii.Duty * -1 Duty,
           i.ReturnedSaleInvoiceID,
           ii.ReturnedSaleInvoiceItemID,
           i.CurrencyID,
           i.CurrencyRate,
           0,
		   i.CurrencyID
    FROM SLE.ReturnedSaleInvoice i
        INNER JOIN SLE.ReturnedSaleInvoiceItem AS ii
            ON ii.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
        JOIN SLE.SaleType AS st
            ON st.SaleTypeID = i.SaleTypeID
        JOIN CFG.Branch AS b 
            ON b.BranchID=i.BranchID
    WHERE i.Date
          BETWEEN @FromDate AND @EndDate
          AND i.Status <> 2
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL

    -------- PURCHASE -------
    SELECT i.BranchID,
           3 DocType,
           pt.PurchaseTypeID,
           CASE [pt].[Type]
               WHEN 0 THEN
                   1
               ELSE
                   3
           END,
           i.Number,
           CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DATE,
           ii.RowIndex,
           (ii.Price - ii.Discount) Amount,
           0,
           0,
           ii.Tax,
           ii.Duty,
           i.PurchaseInvoiceID,
           ii.PurchaseInvoiceItemID DocID,
           i.CurrencyID,
           i.CurrencyRate,
           0,
		   i.CurrencyID
    FROM VND.PurchaseInvoice i
        INNER JOIN VND.PurchaseInvoiceItem AS ii
            ON ii.PurchaseInvoiceID = i.PurchaseInvoiceID
        INNER JOIN VND.PurchaseType AS pt
            ON pt.PurchaseTypeID = i.[Type]
        INNER JOIN STF.[Stuff] AS s
            ON s.StuffID = ii.StuffID
        JOIN CFG.Branch AS b 
            ON b.BranchID=i.BranchID
    WHERE i.Date
          BETWEEN @FromDate AND @EndDate
          AND
          (
              s.[Type] = 1
              OR (ii.ProformaInvoiceItemID IS NULL)
          )
           AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --- RETURNED PURCHASE ---

    SELECT i.BranchID,
           4 DocType,
           pt.PurchaseTypeID,
           CASE [pt].[Type]
               WHEN 0 THEN
                   1
               ELSE
                   3
           END,
           i.Number,
           CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DATE,
           ii.RowIndex,
           (ii.Price - ii.Discount) * -1 Amount,
           0,
           0,
           ii.Tax * -1 AS Tax,
           ii.Duty * -1 AS Duty,
           i.ReturnInvoiceID,
           ii.ReturnInvoiceItemID DocID,
           i.CurrencyID,
           i.CurrencyRate,
           0,
		   i.CurrencyID
    FROM VND.ReturnInvoice i
        INNER JOIN VND.ReturnInvoiceItem AS ii
            ON ii.ReturnInvoiceID = i.ReturnInvoiceID
        INNER JOIN VND.PurchaseType AS pt
            ON pt.PurchaseTypeID = i.[Type]
        JOIN CFG.Branch AS b 
            ON b.BranchID=i.BranchID
    WHERE i.Date
    BETWEEN @FromDate AND @EndDate
    AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL

    --STORE_SALE
    SELECT s.BranchID,
           CASE
               WHEN i.IsReturnInvoice = 0 THEN
                   5
               ELSE
                   6
           END AS DocType,
           -1,
           1,
           i.Number,
           CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) DATE,
           ii.RowIndex,
           (ii.Price - ii.Discount) * CASE
                                          WHEN i.IsReturnInvoice = 0 THEN
                                              1
                                          ELSE
                                              -1
                                      END Amount,
           0,
           0,
           CASE
               WHEN i.IsReturnInvoice = 0 THEN
                   ii.Tax
               ELSE
                   -ii.Tax
           END Tax,
           CASE
               WHEN i.IsReturnInvoice = 0 THEN
                   ii.Duty
               ELSE
                   -ii.Duty
           END Duty,
           i.PosInvoiceID DocID,
           ii.PosInvoiceItemID,
           -1,
           1,
           0,
		   -1
    FROM POS.PosInvoice i
        INNER JOIN POS.PosInvoiceItem AS ii
            ON ii.PosInvoiceID = i.PosInvoiceID
        INNER JOIN POS.StationShift AS ss
            ON ss.StationShiftID = i.StateShiftID
        INNER JOIN POS.Station AS s
            ON s.StationID = ss.StationID
        JOIN CFG.Branch AS b 
            ON b.BranchID=S.BranchID
    WHERE i.Date
          BETWEEN @FromDate AND @EndDate
          AND i.Status <> 3
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --Payment_Subject  

    SELECT pr.BranchID,
           7 AS DocType,
           -1,
           1,
           pr.Number,
           CFG.GetCLRSaturnDate(pr.Date, @DateFormat, 0, @DateType) DATE,
           ps.RowIndex,
           (ps.Amount - ps.Discount),
           0,
           0,
           0,
           0,
           pr.PaymentReceiptID DocID,
           ps.PaymentSubjectID,
           ps.CurrencyID,
           ps.CurrencyRate,
           1,
		   ps.CurrencyID
    FROM FIN.PaymentSubject AS ps
        INNER JOIN FIN.PaymentReceipt AS pr
            ON pr.PaymentReceiptID = ps.PaymentReceiptID
        INNER JOIN FIN.PaymentType pt
            ON pt.PaymentTypeID = ps.PaymentTypeID
        JOIN CFG.Branch AS b 
            ON b.BranchID=pr.BranchID
    WHERE pr.Date
          BETWEEN @FromDate AND @EndDate
          AND pr.Status <> 1
          AND pt.AnnouncedInAdditionalValue = 1
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --PettyCashCost    

    SELECT pcc.BranchID,
           7 AS DocType,
           -1,
           1,
           pcc.Number,
           CFG.GetCLRSaturnDate(pcc.[Date], @DateFormat, 0, @DateType) DATE,
           pcci.RowIndex,
           (pcci.Amount),
           0,
           0,
           0,
           0,
           pcc.PettyCashCostID DocID,
           pcci.PettyCashCostItemID,
           pc.CurrencyID,
           pcc.CurrencyRate,
           1,
		   pc.CurrencyID
    FROM FIN.PettyCashCost AS pcc
        INNER JOIN FIN.PettyCashCostItem AS pcci
            ON pcci.PettyCashCostID = pcc.PettyCashCostID
        INNER JOIN FIN.PaymentType AS pt
            ON pt.PaymentTypeID = pcci.PaymentTypeID
        INNER JOIN FIN.PettyCash AS pc
            ON pc.PettyCashID = pcc.PettyCashID
        JOIN CFG.Branch AS b 
            ON b.BranchID=pcc.BranchID
    WHERE pcc.[Date]
          BETWEEN @FromDate AND @EndDate
          AND pt.AnnouncedInAdditionalValue = 1
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --DebitCreditNoteItem    

    SELECT dcn.BranchID,
           7 AS DocType,
           -1 [Type],
           1 [NatureType],
           dcn.Number,
           CFG.GetCLRSaturnDate(dcn.Date, @DateFormat, 0, @DateType) DATE,
           dcni.RowIndex,
           (dcni.Amount),
           0,
           0,
           0,
           0,
           dcn.DebitCreditNoteID DocID,
           dcni.DebitCreditNoteItemID,
           dcni.CurrencyID,
           dcni.CurrencyRate,
           1,
		   dcni.CurrencyID
    FROM CFG.DebitCreditNote AS dcn
        INNER JOIN CFG.DebitCreditNoteItem AS dcni
            ON dcni.DebitCreditNoteID = dcn.DebitCreditNoteID
        INNER JOIN FIN.PaymentType AS pt
            ON pt.PaymentTypeID = dcni.PaymentTypeID
                JOIN CFG.Branch AS b 
            ON b.BranchID=dcn.BranchID
    WHERE dcn.Date
          BETWEEN @FromDate AND @EndDate
          AND pt.AnnouncedInAdditionalValue = 1
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    --Clearance    

    SELECT c.BranchID,
           8 AS DocType,
           -1,
           3,
           c.Number,
           CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) DATE,
           ci.RowIndex,
           CASE pi1.ExchangeManner
               WHEN 2 THEN
           ((ROUND((pii.Price - pii.Discount) * pi1.CurrencyRate / c2.ExchangeUnit, @BaseCurtrencyPrecisionCount))
            - ISNULL(pii.AllocationSharingAmount, 0)
           ) / pii.MainQuantity * boli.MainQuantity
               ELSE
           ((ROUND((pii.Price - pii.Discount) * pi1.CurrencyRate / c2.ExchangeUnit, @BaseCurtrencyPrecisionCount)))
           / pii.MainQuantity * boli.MainQuantity
           END,
           0,
           0,
           ISNULL(cccTax.Amount, 0),
           ISNULL(cccDuty.Amount, 0),
           c.ClearanceID DocID,
           ci.ClearanceItemID,
           pi1.CurrencyID,
           1,
           1,
		   pi1.CurrencyID
    FROM FOS.Clearance AS c
        INNER JOIN FOS.ClearanceItem AS ci
            ON ci.ClearanceID = c.ClearanceID
        INNER JOIN FOS.BillOfLadingItem AS boli
            ON boli.BillOfLadingItemID = ci.BillOfLadingItemID
        INNER JOIN VND.PurchaseInvoiceItem AS pii
            ON pii.PurchaseInvoiceItemID = boli.PurchaseInvoiceItemID
        INNER JOIN VND.PurchaseInvoice AS pi1
            ON pi1.PurchaseInvoiceID = pii.PurchaseInvoiceID
        INNER JOIN CFG.Currency AS c2
            ON c2.CurrencyID = pi1.CurrencyID
        LEFT JOIN
        (
            SELECT ccc.ClearanceItemID,
                   SUM(ccc.Amount) AS Amount
            FROM FOS.ClearanceCustomsCost AS ccc
                LEFT JOIN FOS.SpecialCost AS sc
                    ON sc.SpecialCostID = ccc.SpecialCostID
            WHERE sc.ValueAddedTax = 1
            GROUP BY ccc.ClearanceItemID
        ) cccTax
            ON cccTax.ClearanceItemID = ci.ClearanceItemID
        LEFT JOIN
        (
            SELECT ccc.ClearanceItemID,
                   SUM(ccc.Amount) AS Amount
            FROM FOS.ClearanceCustomsCost AS ccc
                LEFT JOIN FOS.SpecialCost AS sc
                    ON sc.SpecialCostID = ccc.SpecialCostID
            WHERE sc.ValueAddedDuty = 1
            GROUP BY ccc.ClearanceItemID
        ) cccDuty
            ON cccDuty.ClearanceItemID = ci.ClearanceItemID
        JOIN CFG.Branch AS b 
            ON b.BranchID=c.BranchID
    WHERE c.[Date]
    BETWEEN @FromDate AND @EndDate
    AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL

    --CostOfOrder 
    SELECT coo.BranchID,
           9 AS DocType,
           -1,
           1,
           coo.Number,
           CFG.GetCLRSaturnDate(coo.Date, @DateFormat, 0, @DateType) DATE,
           cooi.RowIndex,
           (cooi.Amount),
           0,
           (cooi.Amount),
           0,
           0,
           coo.CostOfOrderID DocID,
           cooi.CostOfOrderItemID,
           -1,
           1,
           1,
		   -1
    FROM FOS.CostOfOrder AS coo
        INNER JOIN FOS.CostOfOrderItem AS cooi
            ON cooi.CostOfOrderID = coo.CostOfOrderID
        JOIN CFG.Branch AS b 
            ON b.BranchID=coo.BranchID
    WHERE coo.Date
          BETWEEN @FromDate AND @EndDate
          AND cooi.PurchaseInvoiceItemID IS NULL
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    -- پیمانکار 

    SELECT c.BranchID,
           10 AS DocType,
           -1 AS [Type],
           1 AS NatureType,
           cs.Number,
           CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) AS [Date],
           -1 AS ItemNumber,
           CASE
               WHEN c.StatementDeliverySection = 1 and cst.Type in (1,4) THEN
                   csi.Amount - ISNULL(o.Amount, 0)
               ELSE
                   csi.Amount
           END,
           0 AS InclusiveVatStuffs,
           0 AS ExemptOfVatStuffs,
           csi.Tax,
           csi.Duty,
           cs.ConfirmStatementID AS DocId,
           NULL AS DocItemId,
           cs2.CurrencyID,
           cs.CurrencyRate,
           0,
		   -1
    FROM CNT.ConfirmStatement AS cs
        JOIN CNT.ContractStatement AS cs2
            ON cs2.ContractStatementID = cs.ContractStatementID
        JOIN CNT.ContractStatementItem AS csi
            ON csi.ContractStatementID = cs2.ContractStatementID
        JOIN CNT.[Contract] AS c
            ON c.ContractID = cs.ContractID
        JOIN CFG.Currency AS c2
            ON c2.CurrencyID = cs2.CurrencyID
        JOIN CFG.Branch AS b 
            ON b.BranchID=c.BranchID
		join cnt.ContractStatementType cst
			ON cst.ContractStatementTypeID = cs2.ContractStatementTypeID
        OUTER APPLY
    (
        SELECT TOP (1)
               csi_o.Amount
        FROM CNT.ContractStatement AS cs2_o
            JOIN CNT.ContractStatementItem AS csi_o
                ON csi_o.ContractStatementID = cs2_o.ContractStatementID
        WHERE cs2_o.ContractID = cs.ContractID
              AND cs2_o.Number < cs2.Number
              AND csi_o.ContractSubjectID = csi.ContractSubjectID
        ORDER BY cs2_o.Number DESC
    ) o
    WHERE c.CompanyRoll = 1
          AND cs.[Date]
          BETWEEN @FromDate AND @EndDate
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID)
    UNION ALL
    -- کارفرما 
    SELECT c.BranchID,
           11 AS DocType,
           -1 AS [Type],
           1 AS NatureType,
           cs.Number,
           CFG.GetCLRSaturnDate(cs.[Date], @DateFormat, 0, @DateType) AS [Date],
           -1 AS ItemNumber,
           vcsi.amount,
           0 AS InclusiveVatStuffs,
           0 AS ExemptOfVatStuffs,
           csi.Tax,
           csi.Duty,
           cs.ConfirmStatementID AS DocId,
           NULL AS DocItemId,
           cs2.CurrencyID,
           cs.CurrencyRate,
           0,
		   -1
    FROM CNT.ConfirmStatement AS cs
        JOIN CNT.ContractStatement AS cs2
            ON cs2.ContractStatementID = cs.ContractStatementID
        JOIN CNT.ContractStatementItem AS csi
            ON csi.ContractStatementID = cs2.ContractStatementID
        JOIN CNT.[Contract] AS c
            ON c.ContractID = cs.ContractID
        JOIN CFG.Currency AS c2
            ON c2.CurrencyID = cs2.CurrencyID
        JOIN CFG.Branch AS b 
            ON b.BranchID=c.BranchID
		join cnt.ContractStatementType cst
			ON cst.ContractStatementTypeID = cs2.ContractStatementTypeID
       join cnt.VwContractStatementItem AS vcsi on csi.ContractStatementItemID = vcsi.ContractStatementItemID
    WHERE c.CompanyRoll = 2
          AND cs.Date
          BETWEEN @FromDate AND @EndDate
          AND( @CompanyID IS NULL OR b.CompanyID=@CompanyID);

    ------------------------
    SELECT 0 AS VatItemID,
           sr.BranchId,
           b.Title AS BranchTitle,
           sr.DocType,
           CASE sr.DocType
               WHEN 1 THEN
                   N'فروش'
               WHEN 2 THEN
                   N'برگشت فروش'
               WHEN 3 THEN
                   N'خرید'
               WHEN 4 THEN
                   N'برگشت خرید'
               WHEN 5 THEN
                   N'فروش فروشگاهی'
               WHEN 6 THEN
                   N'برگشت فروشگاهی'
               WHEN 7 THEN
                   N'خرید'     --دریافت و پرداخت
               WHEN 8 THEN
                   N'خرید'     --ترخیص
               WHEN 9 THEN
                   N'خرید'     --هزینه های سفارش
               WHEN 10 THEN
                   N'پیمانکار' --پیمانکار
               WHEN 11 THEN
                   N'کارفرما'  --کارفرما
               ELSE
                   N''
           END AS DocTypeName,
           sr.[Type],
           sr.NatureType,
           CASE sr.NatureType
               WHEN 1 THEN
                   N'داخلی'
               WHEN 2 THEN
                   N'صادراتی'
               ELSE
                   N'واردات'
           END AS NatureTypeName,
           sr.Number,
           sr.DATE,
           sr.ItemNumber,
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(sr.Amount * sr.CurrencyRate / c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(sr.Amount * sr.CurrencyRate * c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               ELSE
                   0
           END AS Amount,
           CASE
               WHEN
               (
                   sr.Tax <> 0
                   OR sr.Duty <> 0
               ) THEN
                   CASE
                       WHEN c.IsBaseCurrencyBasis = 0 THEN
                           ROUND(sr.Amount * sr.CurrencyRate / c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
                       WHEN c.IsBaseCurrencyBasis = 1 THEN
                           ROUND(sr.Amount * sr.CurrencyRate * c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
                       ELSE
                           0
                   END
               ELSE
                   0
           END AS InclusiveVatStuffs,
           CASE
               WHEN
               (
                   sr.Tax = 0
                   AND sr.Duty = 0
               ) THEN
                   CASE
                       WHEN c.IsBaseCurrencyBasis = 0 THEN
                           ROUND(sr.Amount * sr.CurrencyRate / c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
                       WHEN c.IsBaseCurrencyBasis = 1 THEN
                           ROUND(sr.Amount * sr.CurrencyRate * c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
                       ELSE
                           0
                   END
               ELSE
                   0
           END AS ExemptOfVatStuffs,
		   case when VatCurrencyID = -1 then sr.Tax else
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(sr.Tax * sr.CurrencyRate / c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(sr.Tax * sr.CurrencyRate * c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               ELSE
                   0
           END end AS Tax,
		   case when VatCurrencyID = -1 then sr.Duty else
           CASE
               WHEN c.IsBaseCurrencyBasis = 0 THEN
                   ROUND(sr.Duty * sr.CurrencyRate / c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               WHEN c.IsBaseCurrencyBasis = 1 THEN
                   ROUND(sr.Duty * sr.CurrencyRate * c.ExchangeUnit, @BaseCurtrencyPrecisionCount)
               ELSE
                   0
           END end AS Duty,
           sr.DocId,
           sr.DocItemId,
           sr.CurrencyId,
           CASE
               WHEN sr.DocType IN ( 1, 2 ) THEN
                   st.Title
               WHEN sr.DocType IN ( 3, 4 ) THEN
                   pt.Title
               WHEN sr.DocType = 7 THEN
                   N'خرید نقدی'
               WHEN sr.DocType = 8 THEN
                   N'خرید وارداتی'
               WHEN sr.DocType = 9 THEN
                   N'هزینه سفارش'
               WHEN sr.DocType = 10 THEN
                   N'پیمانکار' --پیمانکار
               WHEN sr.DocType = 11 THEN
                   N'کارفرما'  --کارفرما
               ELSE
                   CASE
                       WHEN sr.NewType = 0 THEN
                           N'فروشگاهی'
                       ELSE
                           N'خرید نقدی'
                   END
           END AS TypeTitle,
           CAST(1 AS BIT) AS IsSystem
    INTO #calculationResult
    FROM #T AS sr
    INNER JOIN CFG.Branch AS b
        ON b.BranchID = sr.BranchId
    INNER JOIN CFG.Currency AS c
        ON c.CurrencyID = sr.CurrencyId
    INNER JOIN CFG.Currency AS vatc
        ON vatc.CurrencyID = sr.VatCurrencyID
    LEFT JOIN SLE.SaleType AS st
        ON st.SaleTypeID = sr.[Type]
    LEFT JOIN VND.PurchaseType AS pt
        ON pt.PurchaseTypeID = sr.[Type];

    DECLARE @Id INT

    IF EXISTS (
			    SELECT v.VatID
				FROM CFG.Vat v
				WHERE FromDate = @FromDate
				AND CompanyID = @CompanyID
				AND EndDate = @EndDate
				AND FinancialPeriodID = @FinancialPeriod
              )
    BEGIN
        RAISERROR('Messages.DuplicateVatForCompanyInFromDateAndEndDate', 16, 13);
    END

    INSERT CFG.Vat
    (
        FromDate,
        EndDate,
        InclusiveSale,
        ExemptSale,
        Export,
        InclusivePurchase,
        ExemptPurchase,
        InclusiveImport,
        ExemptImport,
        TaxOfSale,
        DutyOfSale,
        TaxOfPurchase,
        DutyOfPurchase,
        TaxOfImport,
        DutyOfImport,
        FinancialPeriodID,
        Creator,
        CreationDate,
        Version,
        LastEditor,
        LastEditionDate,
        CalculationDate,
        CompanyID
    )
    VALUES
    (   @FromDate,        -- FromDate - date
        @EndDate,         -- EndDate - date
        0,                -- InclusiveSale - decimal(30, 4)
        0,                -- ExemptSale - decimal(30, 4)
        0,                -- Export - decimal(30, 4)
        0,                -- InclusivePurchase - decimal(30, 4)
        0,                -- ExemptPurchase - decimal(30, 4)
        0,                -- InclusiveImport - decimal(30, 4)
        0,                -- ExemptImport - decimal(30, 4)
        0,                -- TaxOfSale - decimal(30, 4)
        0,                -- DutyOfSale - decimal(30, 4)
        0,                -- TaxOfPurchase - decimal(30, 4)
        0,                -- DutyOfPurchase - decimal(30, 4)
        0,                -- TaxOfImport - decimal(30, 4)
        0,                -- DutyOfImport - decimal(30, 4)
        @FinancialPeriod, -- FinancialPeriodID - int
        @UserID,          -- Creator - int
        GETDATE(),        -- CreationDate - datetime
        0,                -- Version - int
        @UserID,          -- LastEditor - int
        GETDATE(),        -- LastEditionDate - datetime
        NULL,             -- CalculationDate - date
        @CompanyID
        );

    SET @Id = SCOPE_IDENTITY();

    INSERT CFG.VatItem
    (
        VatID,
        DocType,
        Amount,
        InclusiveVatStuffs,
        ExemptOfVatStuffs,
        Tax,
        Duty,
        Selected,
        Creator,
        CreationDate,
        Version,
        Type,
        Date,
        Number,
        LastEditor,
        LastEditionDate,
        DocID,
        DocItemId,
        NatureType,
        IsSystem
    )
    SELECT @Id,
           cr.DocType,
           cr.Amount,
           cr.InclusiveVatStuffs,
           cr.ExemptOfVatStuffs,
           cr.Tax,
           cr.Duty,
           0,
           @UserID,
           GETDATE(),
           0,
           cr.Type,
           cr.DATE,
           cr.Number,
           @UserID,
           GETDATE(),
           cr.DocId,
           cr.DocItemId,
           cr.NatureType,
           cr.IsSystem
    FROM #calculationResult AS cr;
	SELECT @Id
END;
