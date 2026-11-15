-------------------------------------
CREATE   VIEW [FIN].vwReceivedCheque
as 
WITH cte as
     (
         SELECT cfg.GetuserCulture() Culture
     ),
     cte2 as(
         SELECT ci.Culture,
                ci.CultureNo
         FROM   cfg.CultureInfo  AS ci
                JOIN cte         AS c
                     ON  c.Culture = ci.Culture
     )

SELECT ISNULL(p2.PartyID, p.PartyID)     PartyID,
       CASE 
            WHEN c.CultureNo = 1 THEN ISNULL(p2.title, p.Title) + ' ' + ISNULL(p2.LastName, ISNULL(p.LastName, ''))
            ELSE ISNULL(p2.title2, p.Title2) + ' ' + ISNULL(p2.LastName2, ISNULL(p.LastName2, ''))
       END                               PartyFullName,
       ISNULL(p2.DlID, p.DlID)           DlID,
       rc.LastState,
       rc.LastFlow,
       rc.Number,
       rc.CashID,
       rc.BankID,
       rc.ReceivedCheqeID,
       rc.Date,
       rr.[Date]                         ReceiveDate,
       rc.CurrencyID,
       rc.CurrencyRate,
       rc.Amount,
       rr.BranchID,
       rr.ReceiveReceiptID,
       rc.BankBranchCode,
       rc.BankBranchName,
       rc.AccountNumber,
       rc.Commercial,
       CASE 
            WHEN rr.DeliverChequeID is NOT NULL THEN 'PosCheque'
            ELSE 'Ordinary'
       END                               ChequeSource,
       rr.[Status]
FROM   fin.ReceivedCheqe rc
       cross JOIN cte2                AS c
       JOIN fin.ReceiveReceipt rr
            ON  rc.ReceiveReceiptID = rr.ReceiveReceiptID
       left JOIN (
                SELECT a.*,
                       posri.TracingNumber,
                       posri.ItemType from pos.DeliverChequeItem a
                       join pos.PosReceiptItem AS posri on posri.PosReceiptItemID = a.PosReceiptItemID
       ) dci
            ON  rr.DeliverChequeID = dci.DeliverChequeID
            AND rc.Number = dci.TracingNumber
            AND dci.ItemType = 5
       left JOIN pos.PosReceiptItem pri
            ON  dci.PosReceiptItemID = pri.PosReceiptItemID
       left JOIN pos.PosReceipt pr
            ON  pri.PosReceiptID = pr.PosReceiptID
       inner JOIN cfg.Party p
            ON  rr.PartyID = p.PartyID
       left JOIN cfg.Party p2
            ON  pr.CustomerID = p2.PartyID
            
