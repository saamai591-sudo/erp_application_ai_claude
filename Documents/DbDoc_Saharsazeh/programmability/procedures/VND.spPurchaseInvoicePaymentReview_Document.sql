------------------------------------- 
CREATE   proc vnd.spPurchaseInvoicePaymentReview_Document
(@FromDate DATE, @ToDate DATE)

as
DECLARE @DateFormat     NVARCHAR(20),
        @DateType       INT

SET @DateFormat = cfg.GetCurrentUserDateFormat()
SET @DateType = cfg.GetCurrentUserDateType()
SELECT *
INTO   #vwBranchAccess
FROM   cfg.vwBranchAccess AS vba


SELECT vpiprds.BaseDocumentID,
       vpiprds.DLID,
       vpiprds.CurrencyID,
       vpiprds.BranchID,
       SUM(vpiprds.Amount)         Amount,
       SUM(vpiprds.PaidAmount)     PaidAmount
       into #vwPurchaseInvoicePaymentReviewDataSource
FROM   vnd.vwPurchaseInvoicePaymentReviewDataSource AS vpiprds
WHERE  vpiprds.BaseDocumentDate between @FromDate and @ToDate
GROUP BY
       BaseDocumentID,
       vpiprds.DLID,
       vpiprds.CurrencyID,
       vpiprds.BranchID

SELECT d.Code DlCode,
       d.Title                      DlTitle,
       d.Title2                     DlTitle2,
       c.Title                      CurrencyTitle,
       c.Title2                     CurrencyTitle2,
       b.Code                       BranchCode,
       b.Title                      BranchTitle,
       b.Title2                     BranchTitle2,
       pi1.PurchaseInvoiceID,
       pi1.Number,
       cfg.GetCLRSaturnDate(pi1.[Date], @DateFormat, 0, @dateType) Date,
       pi1.InvoiceNumber,
       cfg.GetCLRSaturnDate(pi1.InvoiceDate, @DateFormat, 0, @dateType) PurchaseInvoiceDate,
       src.Amount,src.PaidAmount,src.Amount-src.PaidAmount RemainAmount,
       'PurchaseInvoice' As Document,
       pi1.PurchaseInvoiceID as DocumentID       
FROM   #vwPurchaseInvoicePaymentReviewDataSource AS src
       JOIN acc.DL               AS d
            ON  src.DLID = d.DLID
       JOIN cfg.Currency         AS c
            ON  src.CurrencyID = c.CurrencyID
       JOIN #vwBranchAccess   AS vba
            ON  vba.BranchID = src.BranchID
       JOIN cfg.Branch           AS b
            ON  b.BranchID = vba.BranchID
       JOIN vnd.PurchaseInvoice  AS pi1
            ON  src.BaseDocumentID = pi1.PurchaseInvoiceID

