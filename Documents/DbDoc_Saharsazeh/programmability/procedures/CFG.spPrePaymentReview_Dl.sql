		
---------Start of #7336
CREATE   proc cfg.spPrePaymentReview_Dl
(@ToDate DATE)
as

SELECT * into #vwBranchAccess
FROM cfg.vwBranchAccess AS vba

  SELECT vppds.DLID,
                  vppds.CurrencyID,
                  SUM(vppds.Amount) Amount,
                  SUM(vppds.DepreciatedAmount) DepreciatedAmount,
                  SUM(vppds.Amount) - SUM(vppds.DepreciatedAmount) Remain
                  into #Party
           FROM   cfg.vwPrePaymentDataSource AS vppds    
           join #vwBranchAccess AS vba on vba.BranchID = vppds.BranchID       
         WHERE vppds.BaseDocumentDate <= @ToDate
           GROUP BY
                  vppds.DLID,
                  vppds.CurrencyID
                  
                  
                  

SELECT d.Code,
       d.Title DlTitle,
       d.Title2 DlTitle2,
       c.Title CurrencyTitle,
       c.Title2 CurrencyTitle2,
       c.CurrencyID,
       d.DLID,
       src.Amount,
       src.DepreciatedAmount,
       src.Remain
FROM   #Party src
       JOIN acc.DL        AS d
            ON  d.DLID = src.DLID
       JOIN cfg.Currency  AS c
            ON  c.CurrencyID = src.CurrencyID
