
---------------------------------------------------------------
CREATE   VIEW [CFG].vwSaleAndPurchaseParty
AS
----فروش فروشگاهی
SELECT CustomerID,
       i.FinancialPeriodID,
       'AccumulatedSale'        AS [Type],
       vptt.CustomerTaxType     AS HCType1Code,
       NULL                     AS HCForoushandeType1Code,
       [i].[Date]               AS [date],
       0                        AS addressId,
       -1                       AS CurrencyID,
	   s.BranchID
FROM   POS.PosInvoice           AS i
JOIN cfg.VwPartyTaxType  AS vptt
            ON  i.CustomerID = vptt.PartyID
join pos.StationShift ss on ss.StationShiftID = i.StateShiftID
join pos.Station s on s.StationID = ss.StationID
 -- فاکتور فروش          
 UNION
SELECT i.CustomerID,
       i.FinancialPeriodID,
       'Sale'                   AS [Type],
       vptt.CustomerTaxType     AS HCType1Code,
       NULL                     AS HCForoushandeType1Code,
       [i].[Date]               AS [date],
       va.AddressID,
       i.CurrencyID,
	   i.BranchID
FROM   SLE.Invoice              AS i
       JOIN cfg.VwPartyTaxType  AS vptt
            ON  i.CustomerID = vptt.PartyID
       LEFT JOIN cfg.VwAddress  AS va
            ON  i.CustomerID = va.PartyID
            AND va.IsMain = 1
   -- برگشت از فروش        
 UNION
SELECT i.CustomerID,
       i.FinancialPeriodID,
       'Sale'                   AS [Type],
       vptt.CustomerTaxType     AS HCType1Code,
       NULL                     AS HCForoushandeType1Code,
       [i].[Date]               AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       i.CurrencyID,
	   i.BranchID
FROM   SLE.ReturnedSaleInvoice  AS i
       JOIN cfg.VwPartyTaxType  AS vptt
            ON  i.CustomerID = vptt.PartyID
       LEFT JOIN CFG.vwAddress  AS a2
            ON  a2.PartyID = i.CustomerID
            AND a2.IsMain = 1
 -- فاکتور خرید  
UNION
SELECT p.PartyID,
       i.FinancialPeriodID,
       'Purchase'                   AS [Type],
       NULL                         AS HCType1Code,
       vptt.VendorTaxType           AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE i.[Date]
       END                          AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       i.CurrencyID,
	   i.BranchID
FROM   VND.PurchaseInvoice          AS i
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  i.PreVoucherID = PIVoucher.PreVoucherID
       INNER JOIN CFG.Party         AS p
            ON  p.DlID = i.DlID
       INNER JOIN VND.PurchaseType  AS pt
            ON  pt.PurchaseTypeID = i.[Type]
       JOIN cfg.VwPartyTaxType      AS vptt
            ON  p.PartyID = vptt.PartyID
       LEFT JOIN CFG.vwAddress      AS a2
            ON  a2.PartyID = p.PartyID
            AND a2.IsMain = 1
WHERE  pt.[Type] = 0 
 -- حق العملکاری  
 UNION
SELECT p.PartyID,
       i.FinancialPeriodID,
       'Purchase'                   AS [Type],
       NULL                         AS HCType1Code,
       vptt.VendorTaxType           AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE i.[Date]
       END                          AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       i.CurrencyID,
	   i.BranchID
FROM   VND.PurchaseInvoice          AS i
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  i.PreVoucherID = PIVoucher.PreVoucherID
       INNER JOIN vnd.PurchaseType  AS pt
            ON  pt.PurchaseTypeID = i.[Type]
       INNER JOIN CFG.Party         AS p
            ON  p.PartyID = pt.PartyID
       JOIN cfg.VwPartyTaxType      AS vptt
            ON  p.PartyID = vptt.PartyID
       LEFT JOIN CFG.vwAddress      AS a2
            ON  a2.PartyID = p.PartyID
            AND a2.IsMain = 1
-- برگشت به خرید
UNION
SELECT p.PartyID,
       i.FinancialPeriodID,
       'Purchase'                   AS [Type],
       NULL                         AS HCType1Code,
       vptt.VendorTaxType                       AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE i.[Date]
       END                          AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       i.CurrencyID,
	   i.BranchID
FROM   VND.ReturnInvoice            AS i
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  i.PreVoucherID = PIVoucher.PreVoucherID
       INNER JOIN CFG.Party         AS p
            ON  p.DlID = i.DlID
       INNER JOIN VND.PurchaseType  AS pt
            ON  pt.PurchaseTypeID = i.[Type]
INNER JOIN cfg.VwPartyTaxType AS vptt ON p.PartyID=vptt.PartyID
       LEFT JOIN CFG.vwAddress        AS a2
            ON  a2.PartyID = p.PartyID
            AND a2.IsMain = 1
WHERE  pt.[Type] = 0
 -- اعلامیه پرداخت        
UNION
SELECT pr.PartyID,
       pr.FinancialPeriodID,
       'AccumulatedPurchase'          AS [Type],
       NULL                           AS HCType1Code,
       vptt.VendorTaxType                         AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE pr.[Date]
       END                            AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       ps.CurrencyID,
	   pr.BranchID
FROM   FIN.PaymentSubject             AS ps
       INNER JOIN FIN.PaymentReceipt  AS pr
            ON  pr.PaymentReceiptID = ps.PaymentReceiptID
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  pr.PreVoucherID = PIVoucher.PreVoucherID
       INNER JOIN FIN.PaymentType
            ON  FIN.PaymentType.PaymentTypeID = ps.PaymentTypeID
INNER JOIN cfg.VwPartyTaxType AS vptt ON vptt.PartyID = pr.PartyID
       LEFT JOIN CFG.vwAddress          AS a2
            ON  a2.PartyID = pr.PartyID
            AND a2.IsMain = 1
WHERE  AnnouncedInAdditionalValue = 1
-- تنخواه
UNION
SELECT pcci.PartyID,
       pcc.FinancialPeriodID,
       'AccumulatedPurchase'             AS [Type],
       NULL                              AS HCType1Code,
       vptt.VendorTaxType                            AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE pcc.[Date]
       END                               AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       pc.CurrencyID,
	   pcc.BranchID
FROM   FIN.PettyCashCost                 AS pcc
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  pcc.PreVoucherID = PIVoucher.PreVoucherID
       INNER JOIN FIN.PettyCashCostItem  AS pcci
            ON  pcci.PettyCashCostID = pcc.PettyCashCostID
       INNER JOIN FIN.PaymentType        AS pt
            ON  pt.PaymentTypeID = pcci.PaymentTypeID
       INNER JOIN FIN.PettyCash          AS pc
            ON  pc.PettyCashID = pcc.PettyCashID
LEFT JOIN cfg.VwPartyTaxType AS vptt ON vptt.PartyID = pcci.PartyID
       LEFT JOIN CFG.vwAddress             AS a2
            ON  a2.PartyID = pcci.PartyID
            AND a2.IsMain = 1
WHERE  pt.AnnouncedInAdditionalValue = 1
       -- تایید مالی      
 UNION
SELECT c.PartyID,
       cs.FinancialPeriodID,
       'ConfirmStatement'          AS [Type],
       NULL                        AS HCType1Code,
       vptt.VendorTaxType                      AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE cs.[Date]
       END                         AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       c.CurrencyID,
	   co.BranchID
FROM   CNT.ConfirmStatement        AS cs
LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
    ON  cs.PreVoucherID = PIVoucher.PreVoucherID
JOIN CNT.ContractStatement  AS c
    ON  c.ContractID = cs.ContractID
JOIN CNT.Contract co on co.ContractID = cs.ContractID
INNER JOIN cfg.VwPartyTaxType AS vptt ON vptt.PartyID = c.PartyID
LEFT JOIN CFG.vwAddress       AS a2
    ON  a2.PartyID = c.PartyID
    AND a2.IsMain = 1
   --اعلامیه بدهکار بستانکار -----------------------------------------------------------
 UNION
SELECT dcni.PartyID,
       dcn.FinancialPeriodID,
       'AccumulatedPurchase'         AS [Type],
       NULL                          AS HCType1Code,
       vptt.VendorTaxType                        AS HCForoushandeType1Code,
       CASE 
            WHEN (
                     SELECT c.ConfigValue
                     FROM   CFG.Configuration AS c
                     WHERE  c.ConfigKey = 'DateInPurchaseDocuments'
                 ) = 2 THEN ISNULL(PIVoucher.[Date], '1900-01-01')
            ELSE dcn.[Date]
       END                           AS [date],
       CASE 
            WHEN a2.AddressID IS NULL THEN 0
            ELSE a2.AddressID
       END,
       ps.CurrencyID,
	   dcn.BranchID
FROM   cfg.DebitCreditNote           AS dcn
       LEFT JOIN acc.VWVoucherPrevoucher PIVoucher
            ON  dcn.PreVoucherID = PIVoucher.PreVoucherID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  dcni.DebitCreditNoteID = dcn.DebitCreditNoteID
       JOIN fin.PaymentSubject       AS ps
            ON  ps.PaymentSubjectID = dcni.PaymentSubjectID
       INNER JOIN cfg.VwPartyTaxType AS vptt ON vptt.PartyID = dcni.PartyID
       LEFT JOIN CFG.vwAddress         AS a2
            ON  a2.PartyID = dcni.PartyID
            AND a2.IsMain = 1
WHERE  dcni.[Type] = 0;
