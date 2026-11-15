
CREATE   PROC [CFG].GetTaxData
(
    @fromDate			DATE,
    @toDate				DATE,
    @FinancialPeriodID	INT,
    @CompanyID			INT
)
AS
BEGIN
    DECLARE @CultureInfo VARCHAR(10),
            @CultureNo   VARCHAR(10),
            @Culture VARCHAR(25);

    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture

    SELECT * INTO #vwBranchAccess
    FROM cfg.vwBranchAccess AS vba        
              
	create table #Temp
	(
	DocumentName NVARCHAR(256),
	DocumentID int,
	[Status] TinyInt,
	ErrorDetail NVARCHAR(max),
	Number NVARCHAR(256),
	Date VARCHAR(50),
	DlCode NVARCHAR(256),
	DlTitle NVARCHAR(MAX),
	CurrencyTitle NVARCHAR(256),
	Amount decimal(36,10),
	Tax decimal(36,10),
	SaleType NVARCHAR(256),
	InvoiceType NVARCHAR(250),
	[Settellment] TinyInt,
	[SettellmentEditable] bit,
    [Article9] bit
	)
	
	
	DECLARE @InvoiceNeedConfirm NVARCHAR(10)
	
	SELECT @InvoiceNeedConfirm = ISNULL(c.ConfigValue,'false') FROM cfg.Configuration AS c
	WHERE c.ConfigKey = 'InvoiceNeedConfirm'
	

   ----Invoice
   insert into #Temp
    SELECT 
		   'Invoice' DocumentName,
           a.InvoiceID DocumentID,
           CAST(CASE
                    WHEN td.[Status] IS NULL THEN
                        0
                    ELSE
                        td.[Status]
                END AS TINYINT) AS [Status],
           td.ErrorDetail,
           CAST(a.Number AS NVARCHAR(256)) Number,
           CFG.GetCLRSaturnDate(a.Date, 'YYYY/MM/DD', 0, 0) Date,
           c.Code DlCode,
           c.Title DlTitle,
           d.Title CurrencyTitle,
           a.TotalPrice - a.TotalDiscount Amount,
           a.TotalTax + a.TotalDuty Tax,
           CASE @CultureNo
               WHEN 2 THEN
                   st.Title2
               ELSE
                   st.Title
           END AS SaleType,
           CASE
               WHEN  ecfd.EntityID IS NOT NULL THEN
                   N' فروش به مصرف کننده نهایی - نوع 2'
               ELSE
                   N'فروش عادی - نوع 1'
           END AS InvoiceType,           
		   CASE WHEN 
			comp.DefaultSettellment = 3  then 
		   		CASE WHEN  NR.done <> 0 or ecfd.EntityID is not null then 1 else 2 END
		   else 
		   	comp.DefaultSettellment
		   END  Settlement ,
		   1 SettlementIsEditable,
           ISNULL(td.Article9, 0) Article9
    FROM SLE.Invoice a
		INNER JOIN sle.Invoice_NonReceived NR
			on NR.InvoiceID = A.InvoiceID
        INNER JOIN CFG.Branch br
            ON br.BranchID = a.BranchID
        INNER JOIN cfg.Company AS comp on comp.CompanyID = br.CompanyID    
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = a.BranchID
        INNER JOIN CFG.Party b
            ON a.CustomerID = b.PartyID
        INNER JOIN ACC.DL c
            ON c.DLID = b.DlID
        INNER JOIN CFG.Currency d
            ON d.CurrencyID = a.CurrencyID
        INNER JOIN SLE.SaleType AS st
            ON st.SaleTypeID = a.SaleTypeID
        LEFT JOIN
        (
            SELECT DocumentID,
                   [Status],
                   ErrorDetail,
                   [Article9]
            FROM CFG.TaxData
            WHERE DocumentName = 'invoice'
                  AND [Status] = 3
        ) AS td
            ON a.InvoiceID = td.DocumentID
        LEFT JOIN
        (
            SELECT b.EntityID
            FROM CFG.EntityCustomeField a
                JOIN CFG.EntityCustomeFieldData b
                    ON a.EntityCustomeFieldID = b.EntityCustomeFieldID
                JOIN CFG.LookupDataItem c
                    ON b.LookupDataItemID = c.LookupDataItemID
            WHERE a.FieldName = 'HCType1Code'
                  AND c.Code = 8
        ) ecfd
            ON ecfd.EntityID = b.PartyID
    WHERE a.FinancialPeriodID = @FinancialPeriodID
          AND Date
          BETWEEN @fromDate AND @toDate
          AND NOT EXISTS
				(
					SELECT 1
					FROM CFG.TaxData
					WHERE DocumentName = 'invoice'
						  AND DocumentID = a.InvoiceID
						  AND Status IN ( 2, 4 )
				)
          AND br.CompanyID = @CompanyID
          AND ((@InvoiceNeedConfirm = 'true' and a.SaleInvoiceStatus = 2)
                      or (@InvoiceNeedConfirm = 'false' and  a.SaleInvoiceStatus <> 5))
   --EditedInvoice
   insert into #Temp
    SELECT 
		   'InvoiceCorrection' DocumentName,
           ic.InvoiceCorrectionID DocumentID,
           CAST(CASE
                    WHEN td.[Status] IS NULL THEN
                        0
                    ELSE
                        td.[Status]
                END AS TINYINT) AS [Status],
           td.ErrorDetail,
           CAST(ic.Number AS NVARCHAR(256)) Number,
           CFG.GetCLRSaturnDate(ic.[Date], 'YYYY/MM/DD', 0, 0) Date,
          c.Code DlCode,
           c.Title DlTitle,
           d.Title CurrencyTitle,
           total.Price-total.Discount Amount,
           total.Vat Tax,
           CASE @CultureNo
               WHEN 2 THEN
                   st.Title2
               ELSE
                   st.Title
           END AS SaleType,
           CASE
               WHEN  ecfd.EntityID IS NOT NULL THEN
                   N' فروش به مصرف کننده نهایی - نوع 2'
               ELSE
                    N'فروش عادی - نوع 1'
           END AS InvoiceType,           
		   CASE WHEN 
			comp.DefaultSettellment = 3  then 
		   		CASE WHEN  NR.done <> 0 or ecfd.EntityID is not null then 1 else 2 END
		   else 
		   	comp.DefaultSettellment
		   END  Settlement ,
		   1 SettlementIsEditable,
           ISNULL(td.Article9, 0) Article9
    FROM 
    sle.InvoiceCorrection AS ic
    join   SLE.Invoice a on ic.ParentInvoiceID = a.InvoiceID
		INNER JOIN sle.Invoice_NonReceived NR
			on NR.InvoiceID = A.InvoiceID
        INNER JOIN CFG.Branch br
            ON br.BranchID = a.BranchID
        INNER JOIN cfg.Company AS comp on comp.CompanyID = br.CompanyID    
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = a.BranchID
        INNER JOIN CFG.Party b
            ON ic.CustomerID = b.PartyID
        INNER JOIN ACC.DL c
            ON c.DLID = b.DlID
        INNER JOIN CFG.Currency d
            ON d.CurrencyID = a.CurrencyID
        INNER JOIN SLE.SaleType AS st
            ON st.SaleTypeID = a.SaleTypeID
        LEFT JOIN
        (
            SELECT DocumentID,
                   [Status],
                   ErrorDetail,
                   [Article9]
            FROM CFG.TaxData
            WHERE DocumentName = 'InvoiceCorrection'
                  AND [Status] = 3
        ) AS td
            ON ic.InvoiceCorrectionID = td.DocumentID
        LEFT JOIN
        (
            SELECT b.EntityID
            FROM CFG.EntityCustomeField a
                JOIN CFG.EntityCustomeFieldData b
                    ON a.EntityCustomeFieldID = b.EntityCustomeFieldID
                JOIN CFG.LookupDataItem c
                    ON b.LookupDataItemID = c.LookupDataItemID
            WHERE a.FieldName = 'HCType1Code'
                  AND c.Code = 8
        ) ecfd
            ON ecfd.EntityID = b.PartyID
         left join (
            	SELECT ici.InvoiceCorrectionID,SUM(ici.RevisionPrice) Price,SUM(ici.RevisionDiscount) Discount,
            	SUM(ici.RevisionVat) Vat,SUM(ici.RevisionNetPrice) NetPrice
            	 FROM sle.InvoiceCorrectionItem AS ici
            	GROUP BY ici.InvoiceCorrectionID          ) Total on ic.InvoiceCorrectionID = total.InvoiceCorrectionID    
            
    WHERE  ic.Date
          BETWEEN @fromDate AND @toDate
          AND NOT EXISTS
				(
					SELECT 1
					FROM CFG.TaxData
					WHERE DocumentName = 'InvoiceCorrection'
						  AND DocumentID = ic.InvoiceCorrectionID
						  AND Status IN ( 2, 4 )
				)
          AND br.CompanyID = @CompanyID

    -- ReturnInvoice                             
    insert into #Temp
    SELECT 'ReturnedSaleInvoice' DocumentName,
           a.ReturnedSaleInvoiceID DocumentID,
           CAST(CASE
                    WHEN td.[Status] IS NULL THEN
                        0
                    ELSE
                        td.[Status]
                END AS TINYINT) AS [Status],
           td.ErrorDetail,
           CAST(a.Number AS NVARCHAR(256)) Number,
           CFG.GetCLRSaturnDate(a.Date, 'YYYY/MM/DD', 0, 0) Date,
           c.Code DlCode,
           c.Title DlTitle,
           d.Title CurrencyTitle,
           a.TotalPrice - a.TotalDiscount Amount,
           a.TotalTax + a.TotalDuty Tax,
           CASE @CultureNo
               WHEN 2 THEN
                   st.Title2
               ELSE
                   st.Title
           END SaleType,
           CASE
               WHEN  ecfd.EntityID IS NOT NULL THEN
                  N' فروش به مصرف کننده نهایی - نوع 2'
               ELSE
                   N'فروش عادی - نوع 1'
           END AS InvoiceType,
		   1,
		   1,
           ISNULL(td.Article9, 0) Article9
    FROM SLE.ReturnedSaleInvoice a
        INNER JOIN CFG.Branch br
            ON br.BranchID = a.BranchID
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = a.BranchID
        JOIN CFG.Party b
            ON a.CustomerID = b.PartyID
        JOIN ACC.DL c
            ON c.DLID = b.DlID
        JOIN CFG.Currency d
            ON d.CurrencyID = a.CurrencyID
        JOIN SLE.SaleType AS st
            ON st.SaleTypeID = a.SaleTypeID
        LEFT JOIN
        (
            SELECT DocumentID,
                   [Status],
                   ErrorDetail,
                   [Article9]
            FROM CFG.TaxData
            WHERE DocumentName = 'ReturnedSaleInvoice'
                  AND [Status] = 3
        ) AS td
            ON a.ReturnedSaleInvoiceID = td.DocumentID
        LEFT JOIN
        (
            SELECT b.EntityID
            FROM CFG.EntityCustomeField a
                JOIN CFG.EntityCustomeFieldData b
                    ON a.EntityCustomeFieldID = b.EntityCustomeFieldID
                JOIN CFG.LookupDataItem c
                    ON b.LookupDataItemID = c.LookupDataItemID
            WHERE a.FieldName = 'HCType1Code'
                  AND c.Code = 8
        ) ecfd
            ON ecfd.EntityID = b.PartyID
    WHERE a.FinancialPeriodID = @FinancialPeriodID
          AND Date
          BETWEEN @fromDate AND @toDate
          AND NOT EXISTS
    (
        SELECT 1
        FROM CFG.TaxData
        WHERE DocumentName = 'ReturnedSaleInvoice'
              AND DocumentID = a.ReturnedSaleInvoiceID
              AND Status IN ( 2, 4 )
    )
          AND br.CompanyID = @CompanyID
    
	insert into #Temp
    SELECT 'ConfirmStatement' DocumentName,
           a.ConfirmStatementID DocumentID,
           CAST(CASE
                    WHEN td.[Status] IS NULL THEN
                        0
                    ELSE
                        td.[Status]
                END AS TINYINT) AS [Status],
           td.ErrorDetail,
           CAST(a.Number AS NVARCHAR(256)) Number,
           CFG.GetCLRSaturnDate(a.Date, 'YYYY/MM/DD', 0, 0) Date,
           c.Code DlCode,
           c.Title DlTitle,
           d.Title CurrencyTitle,
           a.Amount,
           i.Vat Tax,
           CASE @CultureNo
               WHEN 2 THEN
                   cst.Title2
               ELSE
                   cst.Title
           END AS SaleType,
           CASE
               WHEN  ecfd.EntityID IS NOT NULL THEN
                    N' فروش به مصرف کننده نهایی - نوع 2'
               ELSE
                      N'فروش عادی - نوع 1'
           END AS InvoiceType,
		   1,
		   1,
           ISNULL(td.Article9, 0) Article9
    FROM CNT.ConfirmStatement a
        JOIN CNT.ContractStatement cs
            ON a.ContractStatementID = cs.ContractStatementID
        INNER JOIN CNT.Contract AS co
            ON co.ContractID = a.ContractID
        INNER JOIN CFG.Branch br
            ON br.BranchID = co.BranchID
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = co.BranchID
        JOIN CFG.Party b
            ON cs.PartyID = b.PartyID
        JOIN ACC.DL c
            ON c.DLID = b.DlID
        JOIN CFG.Currency d
            ON d.CurrencyID = cs.CurrencyID
        JOIN CNT.ContractStatementType AS cst
            ON cst.ContractStatementTypeID = cs.ContractStatementTypeID
        JOIN
        (
            SELECT ContractStatementID,
                   SUM(Tax + Duty) Vat
            FROM CNT.ContractStatementItem
            GROUP BY ContractStatementID
        ) AS i
            ON i.ContractStatementID = cs.ContractStatementID
        LEFT JOIN
        (
            SELECT DocumentID,
                   [Status],
                   ErrorDetail,
                   [Article9]
            FROM CFG.TaxData
            WHERE DocumentName = 'ConfirmStatement'
                  AND [Status] = 3
        ) AS td
            ON a.ConfirmStatementID = td.DocumentID
        LEFT JOIN
        (
            SELECT b.EntityID
            FROM CFG.EntityCustomeField a
                JOIN CFG.EntityCustomeFieldData b
                    ON a.EntityCustomeFieldID = b.EntityCustomeFieldID
                JOIN CFG.LookupDataItem c
                    ON b.LookupDataItemID = c.LookupDataItemID
            WHERE a.FieldName = 'HCType1Code'
                  AND c.Code = 8
        ) ecfd
            ON ecfd.EntityID = b.PartyID
    WHERE a.FinancialPeriodID = @FinancialPeriodID
          AND a.Date
          BETWEEN @fromDate AND @toDate
		  AND A.Initial = 0
          AND NOT EXISTS
    (
        SELECT 1
        FROM CFG.TaxData
        WHERE DocumentName = 'ConfirmStatement'
              AND DocumentID = a.ConfirmStatementID
              AND Status IN ( 2, 4 )
    )
          AND br.CompanyID = @CompanyID
          AND cst.CompanyRoll = 2

    insert into #Temp
	SELECT 'PosInvoice'                        DocumentName,
       a.PosInvoiceID                      DocumentID,
       CAST(
           CASE 
                WHEN td.[Status] IS NULL THEN 0
                ELSE td.[Status]
           END AS TINYINT
       )                                AS [Status],
       td.ErrorDetail,
       CAST(a.Number AS NVARCHAR(256))     Number,
       CFG.GetCLRSaturnDate(a.Date, 'YYYY/MM/DD', 0, 0) DATE,
       c.Code                              DlCode,
       c.Title                             DlTitle,
       d.Title                             CurrencyTitle,
       a.TotalPrice - a.TotalDiscount      Amount,
       a.TotalTax + a.TotalDuty            Tax,
       CASE @CultureNo
            WHEN 2 THEN s.Title2
            ELSE s.Title
       END                              AS SaleType,
       CASE 
            WHEN  ecfd.EntityID IS NOT NULL THEN   N' فروش به مصرف کننده نهایی - نوع 2'
            ELSE    N'فروش عادی - نوع 1'
       END                              AS InvoiceType,
	   1,
	   0,
       ISNULL(td.Article9, 0) Article9
	FROM   pos.PosInvoice                   AS a
       JOIN pos.StationShift            AS ss
            ON  ss.StationShiftID = a.StateShiftID
       JOIN pos.Station                 AS s
            ON  s.StationID = ss.StationID
       INNER JOIN CFG.Branch br
            ON  br.BranchID = s.BranchID
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = s.BranchID
       JOIN CFG.Party b
            ON  a.CustomerID = b.PartyID
       JOIN ACC.DL c
            ON  c.DLID = b.DlID
       JOIN CFG.Currency d
            ON  d.CurrencyID = -1
       LEFT JOIN (
                SELECT DocumentID,
                       [Status],
                       ErrorDetail,
                       [Article9]
                FROM   CFG.TaxData
                WHERE  DocumentName = 'Posinvoice'
                       AND [Status] = 3
            )                           AS td
            ON  a.PosInvoiceID = td.DocumentID
       LEFT JOIN (
                SELECT b.EntityID
                FROM   CFG.EntityCustomeField a
                       JOIN CFG.EntityCustomeFieldData b
                            ON  a.EntityCustomeFieldID = b.EntityCustomeFieldID
                       JOIN CFG.LookupDataItem c
                            ON  b.LookupDataItemID = c.LookupDataItemID
                WHERE  a.FieldName = 'HCType1Code'
                       AND c.Code = 8
            ) ecfd
            ON  ecfd.EntityID = b.PartyID
	WHERE  a.FinancialPeriodID = @FinancialPeriodID
       AND DATE
           BETWEEN @fromDate AND @toDate
       AND NOT EXISTS
           (
               SELECT 1
               FROM   CFG.TaxData
               WHERE  DocumentName       = 'Posinvoice'
                      AND DocumentID     = a.PosInvoiceID
                      AND STATUS IN (2, 4)
           )
       AND br.CompanyID = @CompanyID
       AND a.IsReturnInvoice = 0

    insert into #Temp
	SELECT 'PosReturnInvoice'                        DocumentName,
       a.PosInvoiceID                      DocumentID,
       CAST(
           CASE 
                WHEN td.[Status] IS NULL THEN 0
                ELSE td.[Status]
           END AS TINYINT
       )                                AS [Status],
       td.ErrorDetail,
       CAST(a.Number AS NVARCHAR(256))     Number,
       CFG.GetCLRSaturnDate(a.Date, 'YYYY/MM/DD', 0, 0) DATE,
       c.Code                              DlCode,
       c.Title                             DlTitle,
       d.Title                             CurrencyTitle,
       a.TotalPrice - a.TotalDiscount      Amount,
       a.TotalTax + a.TotalDuty            Tax,
       CASE @CultureNo
            WHEN 2 THEN s.Title2
            ELSE s.Title
       END                              AS SaleType,
       CASE 
            WHEN  ecfd.EntityID IS NOT NULL THEN   N' فروش به مصرف کننده نهایی - نوع 2'
            ELSE    N'فروش عادی - نوع 1'
       END                              AS InvoiceType,
	   1,
	   0,
       ISNULL(td.Article9, 0) Article9
	FROM   pos.PosInvoice                   AS a
       JOIN pos.StationShift            AS ss
            ON  ss.StationShiftID = a.StateShiftID
       JOIN pos.Station                 AS s
            ON  s.StationID = ss.StationID
       INNER JOIN CFG.Branch br
            ON  br.BranchID = s.BranchID
		INNER JOIN #vwBranchAccess  Access
            ON Access.BranchID = s.BranchID
       JOIN CFG.Party b
            ON  a.CustomerID = b.PartyID
       JOIN ACC.DL c
            ON  c.DLID = b.DlID
       JOIN CFG.Currency d
            ON  d.CurrencyID = -1
       LEFT JOIN (
                SELECT DocumentID,
                       [Status],
                       ErrorDetail,
                       [Article9]
                FROM   CFG.TaxData
                WHERE  DocumentName = 'ReturnPosinvoice'
                       AND [Status] = 3
            )                           AS td
            ON  a.PosInvoiceID = td.DocumentID
       LEFT JOIN (
                SELECT b.EntityID
                FROM   CFG.EntityCustomeField a
                       JOIN CFG.EntityCustomeFieldData b
                            ON  a.EntityCustomeFieldID = b.EntityCustomeFieldID
                       JOIN CFG.LookupDataItem c
                            ON  b.LookupDataItemID = c.LookupDataItemID
                WHERE  a.FieldName = 'HCType1Code'
                       AND c.Code = 8
            ) ecfd
            ON  ecfd.EntityID = b.PartyID
WHERE  a.FinancialPeriodID = @FinancialPeriodID
       AND DATE
           BETWEEN @fromDate AND @toDate
       AND NOT EXISTS
           (
               SELECT 1
               FROM   CFG.TaxData
               WHERE  DocumentName       = 'PosReturnInvoice'
                      AND DocumentID     = a.PosInvoiceID
                      AND STATUS IN (2, 4)
           )
       AND br.CompanyID = @CompanyID
       AND a.IsReturnInvoice = 1;

	   select * from #Temp
END;

